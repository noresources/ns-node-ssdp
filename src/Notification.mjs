'use strict';
import HeaderMapHandler from './HeaderMapHandler.mjs';

export const TYPE = {
	'ALIVE': 'ssdp:alive',
	'DEAD': 'ssdp:byebye'
};

export class Notification {
	constructor (properties, headers) {

		if (!(typeof (properties) == 'object' && properties)) {
			properties = {};
		}
				
		if (!(typeof (headers) == 'object' && headers)) {
			headers = {};
		}
			
		this.headers = new Proxy (headers, HeaderMapHandler);
		
		properties.type = properties.type || TYPE.ALIVE;
		properties.interval = properties.interval || 30000;
		
		for (const k of ['type', 'subject', 'usn', 'interval']) {
			if (!(k in properties)) {
				continue;
			}
			if (!this[k]) {
				this[k] = properties[k];
			}
		}
		
	} // constructor
	
	toString () {
		const lines = ['NOTIFY * HTTP/1.1'];
		for (const k in this.headers) {
			lines.push (k + ': ' + this.headers[k]);
		}
		
		return lines.join ('\r\n') + '\r\n\r\n';
	}
	
	toSearchResponse () {
		const lines = [
			'HTTP/1.1 200 OK',
			'S: ' + this.usn,
			'ST: ' + this.subject,
			'USN: ' + this.usn
		];
		
		
		return lines.join ('\r\n') + '\r\n\r\n';
	}
	
	get key () {
		const lines = [];
		for (const name of ['NT', 'USN']) {
			lines.push (name.toUpperCase() + '=' + this.headers[name]);
		}
		return lines.join ('|');
	}
		
	get usn () {
		return this.headers.USN;
	}
	
	set usn (value) {
		this.headers.USN = value;
	}
	
	get subject () {
		return this.headers.NT;
	}
	
	set subject (value) {
		this.headers.NT = value;
	}
	
	get type () {
		return this.headers.NTS;
	}
	
	set type (value) {
		this.headers.NTS = value;
	}
	
	get interval () {
		if (!('CACHE-CONTROL' in this.headers)) {
			return NaN;
		}

		const value = this.headers['CACHE-CONTROL'];
		
		const m = value.match (/max-age="?([1-9][0-9]*)/i);
		
		if (!m) {
			return NaN;
		}
		return parseInt(m[1]) * 1000;
	}
	
	set interval (value) {
		const seconds = Math.round(value / 1000);
		this.headers['CACHE-CONTROL'] = 'max-age=' + seconds;
	}
}

export default  Notification;