import { EventEmitter } from 'events';
import { Notification, TYPE } from './Notification.mjs';
import PACKAGE from './Package.mjs';
import dgram from 'dgram';

export const MULTICAST_SOCKET = {
	'DEFAULT_ADDRESS': '239.255.255.250',
	'DEFAULT_PORT': 1900
};
	
export default class Protocol extends EventEmitter {
	constructor () {
		super();
		
		this.multicastAddress = MULTICAST_SOCKET.DEFAULT_ADDRESS;
		this.multicastPort = MULTICAST_SOCKET.DEFAULT_PORT;
		this.persistentNotifications = {};
		this._socket = null;
	}
		
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
			this._send (n.toString());
		}
	}
	
	get started () {
		return this._socket ? true : false;
	}
	
	start () {
		if (this.started) {
			throw new Error ('Already started');
		}
			
		if (!this.socket) {
			throw new Error ('Failed to create socket');
		}
		
		this.socket.on ('message', console.debug);
		
		for (const key in this.persistentNotifications) {
			const pn = this.persistentNotifications[key];
			const interval = pn.notification.interval;
			pn.interval = setInterval (() => {
				this._send (pn.message);
			}, interval - (interval * 0.1));
				
			this._send (pn.message);
		}
	} // start
	
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
			
			pn.notification.type = TYPE.DEAD;
			pending.push (this._send (pn.notification.toString()));
		}
		
		try {
			await Promise.all (pending);
		} catch (e) { /**/ }
		
		this._socket.close ();
		this._socket = null;
	}
	
	get socket () {
		if (!this._socket) {
			this._socket = dgram.createSocket({'type': 'udp4',
				'reuseAddr': true });
		}
		
		return this._socket;
	}
	
	_send (message) {
		console.debug ('SEND', message.toString());
		if (typeof (message) == 'string') {
			message = Buffer.alloc(message.length, message, 'ascii');
		}
		
		return new Promise ((resolve, reject) => {
			this.socket.send (message, 0, message.length,
				this.multicastPort, this.multicastAddress, (e) => {
					if (e) {
						reject (e);
						return;
					}
					resolve ();
				});
		});
	}
}

export { Protocol };