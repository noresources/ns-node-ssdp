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

const REQUEST_PATTERN = /^([a-z-]+)\s(.+?)\sHTTP\/[0-9]+\.[0-9]+$/i;
const RESPONSE_PATTERN = /HTTP\/[0-9]+\.[0-9]\s([0-9]+)\s.*/i;

export const MULTICAST_SOCKET = {
	'DEFAULT_ADDRESS': '239.255.255.250',
	'DEFAULT_PORT': 1900
};

export const EVENT = {
	'NOTIFICATION': 'notification',
	'SEARCH': 'search'
};

/**
* SSDP protocol implementation
*/
export default class Protocol extends EventEmitter {
	constructor () {
		super();
		
		this.multicastAddress = MULTICAST_SOCKET.DEFAULT_ADDRESS;
		this.multicastPort = MULTICAST_SOCKET.DEFAULT_PORT;
		this.persistentNotifications = {};
		this.pendingSearches = [];
		this._socket = null;
	}
		
	/**
	* Send NOTIFY message
	* @param {Notification} notification - Notification to send
	* @param {boolean} persist - If true, the notification will be re-send automatically according notification interval value
	*/
	notify (notification, persist) {
		const key = notification.key;
		if (notification.type == TYPE.DEAD && (key in this.persistentNotifications)) {
			clearInterval (this.persistentNotifications[key].interval);
			delete this.persistentNotifications[key];
		}
		
		const n = new Notification ({}, notification.headers);
		
		n.headers.Host = this.multicastAddress + ':' + this.multicastPort;
		if (!('SERVER' in n.headers)) {
			const nodeVersion = process.version.substr(1);
			n.headers.SERVER = 'Node.js/' + nodeVersion + ' SSDP/1.0.3'
			 		+ ' ' + PACKAGE.NAME + '/' + PACKAGE.VERSION;
		}
		
		if (persist && n.type == TYPE.ALIVE) {
			const interval = n.interval;
			if (isNaN(interval) || interval < 1000)  {
				n.interval = 30000;
			}
			
			if (key in this.persistentNotifications) {
				clearInterval (this.persistentNotifications[key].interval);
				this.persistentNotifications[key].interval = null;
			}
			
			const message = n.toString();
			const pn = {
				'notification': notification,
				'message': Buffer.alloc(message.length, message, 'ascii'),
			};
			
			if (this.started) {
				pn.interval = setInterval (() => {
					this._send (pn.message);
				}, interval - (interval * 0.1));
			}
			
			this.persistentNotifications[key] = pn;
		}
		
		if (this.started) {
			return this._send (n.toString());
		}
		
		return Promise.resolve (null);
	}
	
	/**
* Send a M-SEARCH request
* @param {SearchRequest, string} what - Search request or simply subject of the search
	*/
	search (what) {
		if (typeof (what) == 'string') {
			what = new SearchRequest (what);
		}
		
		if (!this.started) {
			this.pendingSearches.push (what);
			return;
		}
		
		this._send (what.toString ());
	}
	
	/**
	* Indicates if the protocol is started
	* @returns {boolean}
	*/
	get started () {
		return this._socket ? true : false;
	}
	
	/**
	* Starts listening SSDP message and emitting notifications
	*/
	start () {
		if (this.started) {
			throw new Error ('Already started');
		}
			
		if (!this.socket) {
			throw new Error ('Failed to create socket');
		}
		
		this.socket.on ('message', this._processMessage.bind(this));

		while (this.pendingSearches.length) {
			const request = this.pendingSearches.shift();
			this._send (request.toString ());
		}
		
		for (const key in this.persistentNotifications) {
			const pn = this.persistentNotifications[key];
			const interval = pn.notification.interval;
			pn.interval = setInterval (() => {
				this._send (pn.message);
			}, interval - (interval * 0.1));
				
			this._send (pn.message);
		}
	} // start
	
	/**
	* Stop listening SSDP message
	* and notify control points that registered service are no more available
	*/
	async stop () {
		if (!this.started) {
			return;
		}
		
		const pending = [];
		for (const key in this.persistentNotifications) {
			const pn = this.persistentNotifications[key];
			if (pn.interval) {
				clearInterval (pn.interval);
				pn.interval = null;
			}
			
			const bye = new Notification ({
				'type': TYPE.DEAD
			}, pn.notification.headers);
			pending.push (this._send (bye));
		}
		
		try {
			await Promise.all (pending);
		} catch (e) { /**/ }
		
		this._socket.close ();
		this._socket = null;
	}
	
	/**
	* @private
	*/
	get socket () {
		if (!this._socket) {
			this._socket = dgram.createSocket({'type': 'udp4',
				'reuseAddr': true });
			this._socket.on ('listening', () => {
				this._socket.addMembership(this.multicastAddress);
			});
			this._socket.bind (this.multicastPort);
		}
		
		return this._socket;
	}
	
	/**
	* @private
	*/
	_send (message, target) {
		if (typeof (message) == 'string') {
			message = Buffer.alloc(message.length, message, 'ascii');
		}
		
		let address = this.multicastAddress;
		let port = this.multicastPort;
		if (typeof (target) == 'object' && target) {
			address = target.address || target.host || address;
			port = target.port || port;
		}
		
		return new Promise ((resolve, reject) => {
			this.socket.send (message, 0, message.length,
				port, address, (e) => {
					if (e) {
						reject (e);
						return;
					}
					resolve ();
				});
		});
	}
	
	/**
	* @private
	*/
	_processMessage (message, emitter) {
		const m = this._parseMessageText (message.toString());
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
			if (key in this.persistentNotifications) {
				return;
			}

			this.emit (EVENT.NOTIFICATION, {
				'notification': n,
				'emitter': emitter
			});
		} else if (m instanceof SearchRequest) {
			for (const key in this.persistentNotifications) {
				const pn = this.persistentNotifications[key];
				if ((m.subject == SEARCH_ALL) || (m.subject == pn.notification.subject)) {
					const response = new SearchResponse({
						'subject': pn.notification.subject,
						'usn': pn.notification.usn
					}, pn.notification.headers);
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
	_parseMessageText (text) {
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
} // class

export { Protocol };