/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';
import { EventEmitter } from 'events';
import { Notification, TYPE } from './Notification.mjs';
import { SearchRequest, SEARCH_ALL } from './SearchRequest.mjs';
import { SearchResponse } from './SearchResponse.mjs';
import PACKAGE from './Package.mjs';
import dgram from 'dgram';
import ip from 'ip';

const MULTICAST_STATE = {
	// Socket is ready
	'READY': 0x01,
	// Membership added
	'MEMBER': 0x02
};

const REQUEST_PATTERN = /^([a-z-]+)\s(.+?)\sHTTP\/[0-9]+\.[0-9]+$/i;
const RESPONSE_PATTERN = /HTTP\/[0-9]+\.[0-9]\s([0-9]+)\s.*/i;
const deepCopy = function (o) {
	return JSON.parse (JSON.stringify(o));
};

/**
* Default SSDP multicast address and port
*/
export const MULTICAST_SOCKET = {
	/** Default SSDP multicast address */
	'DEFAULT_ADDRESS': '239.255.255.250',
	/** Default SSDP multicast port */
	'DEFAULT_PORT': 1900
};

/**
* SSDP protocol event type names
*/
export const EVENT = {
	/**
	 * Service or device presence notification.
	 * For multicast NOTIFY messages and
	 * unicast search responses.
	 */
	'NOTIFICATION': 'notification',
	/**Search request message (M-SEARCH) */
	'SEARCH': 'search'
};

/**
* SSDP protocol implementation
*
* @property {string} signature - Default SERVER and USER-AGENT header field values.
*/
export class Protocol extends EventEmitter {
	/**
	* @param {string} address - SSDP multicast address
	* @param {integer} port - SSDP multicast port
	*/
	constructor (address, port) {
		super();

		const nodeVersion = process.version.substr(1);
		this.signature = 'Node.js/' + nodeVersion + ' SSDP/1.0.3'
			 		+ ' ' + PACKAGE.NAME + '/' + PACKAGE.VERSION;
		
		this._multicastState = 0;
		this._multicastMembershipInterval = null;
		this.multicastAddress = address || MULTICAST_SOCKET.DEFAULT_ADDRESS;
		this.multicastPort = port || MULTICAST_SOCKET.DEFAULT_PORT;
		
		this._persistentNotifications = {};
		this._pendingSearches = [];
		this._multicastSocket = null;
		this._clientSocket = null;
		this._messageListener = this._processMessage.bind(this);
		this._multicastSocketReadyListener = this._handleMulticastSocketListening.bind(this);
		
	}
	
	/**
	* Send NOTIFY message
	*
	* @param {Notification} notification - Notification to send
	* @param {boolean} persist - If true, the notification will be re-send automatically according notification interval value
	*/
	notify (notification, persist) {
		const key = notification.key;
		if (notification.type == TYPE.DEAD && (key in this._persistentNotifications)) {
			clearInterval (this._persistentNotifications[key].interval);
			delete this._persistentNotifications[key];
		}
		
		const n = this.createNotification ({}, notification.headers);
		
		if (persist && n.type == TYPE.ALIVE) {
			const interval = n.interval;
			if (isNaN(interval) || interval < 1000)  {
				n.interval = 30000;
			}
			
			if (key in this._persistentNotifications) {
				clearInterval (this._persistentNotifications[key].interval);
				this._persistentNotifications[key].interval = null;
			}
			
			const message = n.toString();
			const pn = {
				'notification': notification,
				'message': Buffer.alloc(message.length, message, 'ascii'),
			};
			
			if (this.started) {
				pn.interval = setInterval (async () => {
					try {
						await this._send (pn.message);
					} catch (e) { /* Ignore */ }
				}, interval - (interval * 0.1));
			}
			
			this._persistentNotifications[key] = pn;
		}
		
		if (this.started && this._multicastReady) {
			return this._send (n.toString());
		}
		
		return null;
	}
	
	/**
	* Send a M-SEARCH request
	*
	* @param {SearchRequest|string} what - Search request or simply subject of the search
	*/
	search (what) {
		let s;
		if (typeof (what) == 'string') {
			s = this.createSearchRequest (what);
		} else {
			s = this.createSearchRequest ({}, what.headers);
		}
		
		if (!(this.started && this._multicastReady)) {
			this._pendingSearches.push (s);
			return;
		}
		
		return this._send (s.toString ());
	}
	
	/**
	* Create a new Notification to be used with this protocol
	*
	* @param {Array} arguments - Notification constructor arguments.
	*
	* @return {Notification} - A notification with pre-assigned header fields describing the protocol instance.
	*/
	createNotification () {
		const n = new Notification (...arguments);
		return this._populateNotification (n);
	}
	
	/**
	 * Create a new search request
	 *
	 * @param {Array} arguments - SearchRequest constructor arguments.
	 *
	 * @return {SearchRequest} Search request with pre-defined header field describing the protocol instance.
	 */
	createSearchRequest () {
		const s = new SearchRequest (...arguments);
		return this._populateSearchRequest (s);
	}
	
	/**
	* Multicast socket IPv4 address
	*
	* @return {string} - Multicast address
	*/
	get multicastAddress () {
		return this._multicastAddress;
	}
	
	/**
	* Set multicast socket IPv4 address
	*
	* @param {string} value - Multicast socket IPv4 address string
	*/
	set multicastAddress (value) {
		if (this.started) {
			throw new Error ('Multicast address cannot be changed while running');
		}
		
		if (!ip.isV4Format (value)) {
			throw new Error ('Invalid IPv4 address');
		}
		
		this._multicastAddress = value;
	}
	
	/**
	 * Multicast socket port
	 *
	 * @return {number} - Multicast port
	 */
	get multicastPort() {
		return this._multicastPort;
	}
	
	/**
	 * Set multicast socket port
	 *
	 * @param {number} value - Multicast socket port
	 */
	set multicastPort (value) {
		if (this.started) {
			throw new Error ('Multicast port cannot be changed while running');
		}
		
		if (!Number.isInteger (value)) {
			throw new TypeError ('Invalid port number');
		}
			
		this._multicastPort = value;
	}
	
	
	/**
	* Indicates if the protocol is started
	*
	* @return {boolean} true is protocol is started
	*/
	get started () {
		return this._multicastSocket ? true : false;
	}
	
	/**
	* Start listening SSDP message and emit pending messages.
	*/
	start () {
		if (this.started) {
			throw new Error ('Already started');
		}
		
		this._multicastSocket = dgram.createSocket({'type': 'udp4',
			'reuseAddr': true });
		this._multicastSocket.on ('listening', this._multicastSocketReadyListener);
		this._multicastSocket.bind (this._multicastPort);
		this._multicastSocket.on ('message', this._messageListener);

		for (const key in this._persistentNotifications) {
			const pn = this._persistentNotifications[key];
			const interval = pn.notification.interval;
			pn.interval = setInterval (async () => {
				try {
					this._send (pn.message);
				} catch (e) {
					console.error ('notif error', e.message);
				}
			}, interval - (interval * 0.1));
				
			this._send (pn.message);
		}
	} // start
	
	/**
	* Stop listening SSDP message
	* and notify control points that registered service are no more available
	*/
	async stop () {
	
		if (this._multicastMembershipInterval) {
			clearInterval (this._multicastMembershipInterval);
			this._multicastMembershipInterval = null;
		}
	
		if (!this.started) {
			return;
		}
		
		const pending = [];
		for (const key in this._persistentNotifications) {
			const pn = this._persistentNotifications[key];
			if (pn.interval) {
				clearInterval (pn.interval);
				pn.interval = null;
			}
			
			const bye = new Notification ({
				'type': TYPE.DEAD
			}, deepCopy(pn.notification.headers));
			pending.push (this._send (bye));
		}
		
		try {
			await Promise.all (pending);
		} catch (e) { /**/ }
		
		if (this._clientSocket) {
			this._clientSocket.off ('message', this._messageListener);
			this._clientSocket.close();
			this._clientSocket = null;
		}
		
		this._multicastSocket.off ('listening', this._multicastSocketReadyListener);
		this._multicastSocket.off ('message', this._messageListener);
		this._multicastSocket.close ();
		this._multicastSocket = null;
	}
	
	get _multicastReady () {
		const required = MULTICAST_STATE.READY | MULTICAST_STATE.MEMBER;
		return ((this._multicastState & required) == required);
	}
	
	/**
	* @private
	*/
	_send (message, target) {
		if (typeof (message) == 'string') {
			message = Buffer.alloc(message.length, message, 'ascii');
		}
		
		let address = this._multicastAddress;
		let port = this._multicastPort;
		if (typeof (target) == 'object' && target) {
			address = target.address || target.host || address;
			port = target.port || port;
		}
		
		if (!this._clientSocket) {
			this._clientSocket = dgram.createSocket('udp4');
			this._clientSocket.on ('message', this._messageListener);
		}
		
		return new Promise ((resolve, reject) => {
			this._clientSocket.send (message, 0, message.length,
				port, address, (e) => {
					if (e) {
						reject (e);
						return;
					}
					resolve ();
				});
		});
	}
	
	/** @private */
	async _handleMulticastSocketListening() {
	
		let success = await this._tryAddMembership ();
		this._multicastState |= MULTICAST_STATE.READY;
		if (success) {
			return;
		}
		let trying = false;
		this._multicastMembershipInterval = setInterval (async () => {
			if (trying) {
				return;
			}
			trying = true;
			success = await this._tryAddMembership ();
			if (success) {
				clearInterval (this._multicastMembershipInterval);
				this._multicastMembershipInterval = null;
				return;
			}
			trying = false;
		}, 5000);
	}
	
	/**
	* @private
	*/
	async _tryAddMembership () {
		let result = false;
		try {
			await this._multicastSocket.addMembership(this._multicastAddress);
			this._multicastState |= MULTICAST_STATE.MEMBER;
			result = true;
			
			const s = [];
			while (this._pendingSearches.length) {
				const request = this._pendingSearches.shift();
				s.push (this._send (request.toString ()));
			}
			await Promise.all (s);
		} catch (e) {
			/* */
		}
		return result;
	}
	
	/**
	* @private
	*/
	_processMessage (message, emitter) {
		const m = this.__parseMessageText (message.toString());
		if (m instanceof Notification
				|| m instanceof SearchResponse) {
			let n = m;
			
			if (m instanceof SearchResponse) {
				n = new Notification ({
					'subject': m.subject,
					'usn': m.usn
				}, m.headers);
				
				delete n.headers.S;
				delete n.headers.ST;
			}
			
			/* @todo Optional skip */
			
			const key = n.key;
			if (key in this._persistentNotifications) {
				return;
			}

			this.emit (EVENT.NOTIFICATION, {
				'notification': n,
				'emitter': emitter
			});
		} else if (m instanceof SearchRequest) {
			for (const key in this._persistentNotifications) {
				const pn = this._persistentNotifications[key];
				if ((m.subject == SEARCH_ALL) || (m.subject == pn.notification.subject)) {
					const response = new SearchResponse({
						'subject': pn.notification.subject,
						'usn': pn.notification.usn
					}, deepCopy(pn.notification.headers));
					delete response.headers.NT;
					delete response.headers.NTS;
					this._send(response.toString(), emitter);
				}
			}
			
			this.emit (EVENT.SEARCH, {
				'search': m,
				'emitter': emitter
			});
		}
	}
	
	/**
	* @private
	*/
	__parseMessageText (text) {
		const lines = text.split ('\r\n');
		const firstLine = lines.shift();
		const headers = {};
		let name = null;
		let value = '';
		/**
		* @todo Use TOKEN character set for header field name
		*/
		const newFieldPattern = /^([a-z][a-z.-]*):\s*(.*)/i;
		lines.forEach ((line) => {
			const m = line.match (newFieldPattern);
			if (m) {
				if (name) {
					headers[name] = value;
				}
				
				name = m[1];
				value = m[2];
			} else if (name && line.match(/^[ \t]/)) {
				value = value + line;
			} else {
				if (name) {
					headers[name] = value;
				}
				name = null;
				value = '';
			}
		}); // each line
		
		if (name) {
			headers[name] = value;
		}
		
		let m;
		if ((m = firstLine.match (REQUEST_PATTERN))) {
			const method = m[1];
			if (method.toUpperCase() == 'NOTIFY') {
				return new Notification ({}, headers);
			} else if (method.toUpperCase() == 'M-SEARCH') {
				return new SearchRequest ({}, headers);
			}
		} else if ((m = firstLine.match (RESPONSE_PATTERN))) {
			const statusCode = parseInt (m[1]);
			if (statusCode == 200) {
				return new SearchResponse ({}, headers);
			}
		}
	} // parseMessageText
	
	/**
	 * @private
	 */
	_populateNotification (n) {
		if (!('SERVER' in n.headers) && this.signature) {
			n.headers.SERVER = this.signature;
		}
		
		if (!('HOST' in n.headers)) {
			n.headers.HOST = this._multicastAddress + ':' + this._multicastPort;
		}
		
		return n;
	}
	
	/** @private */
	_populateSearchRequest (s) {
		if (!('USER-AGENT' in s.headers) && this.signature) {
			s.headers['USER-AGENT'] = this.signature;
		}
		
		if (!('HOST' in s.headers)) {
			s.headers.HOST = this._multicastAddress + ':' + this._multicastPort;
		}
		
		return s;
	}
} // class

export default Protocol;