/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';
import HeaderMapHandler from './HeaderMapHandler.mjs';

export const TYPE = {
	'ALIVE': 'ssdp:alive',
	'DEAD': 'ssdp:byebye'
};

/**
* Notification message descriptor
*/
export class Notification {
	/**
	* @param {Object} properties - Notification properties
	* @param {Object} headers - Custom message headers
	*/
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
	
	/**
	* Get SSDP message text
	* @returns {string}
	*/
	toString () {
		const lines = ['NOTIFY * HTTP/1.1'];
		for (const k in this.headers) {
			lines.push (k + ': ' + this.headers[k]);
		}
		
		return lines.join ('\r\n') + '\r\n\r\n';
	}
	
	get key () {
		const lines = [];
		for (const name of ['NT', 'USN']) {
			lines.push (name.toUpperCase() + '=' + this.headers[name]);
		}
		return lines.join ('|');
	}

	/**
	* Get USN HTTP header field
	*/
	get usn () {
		return this.headers.USN;
	}
	
	/**
	* Set USN HTTP header field
	* @param {string} value - USN header value
	*/
	set usn (value) {
		this.headers.USN = value;
	}
	
	/**
	* Get notification subject (HT HTTP header)
	* @returns {string}
	*/
	get subject () {
		return this.headers.NT;
	}
	
	/**
	* Set Notification subject (HT HTTP header)
	* @param {string} value - NT HTTP header value
	*/
	set subject (value) {
		this.headers.NT = value;
	}
	
	/**
	* Get Notification type (HTS HTTP header)
	* @returns {string}
	*/
	get type () {
		return this.headers.NTS;
	}

	/**
* Set Notification type (HTS HTTP header)
* @param {string} value - NTS HTTP header value
*/
	set type (value) {
		this.headers.NTS = value;
	}
	
	/**
	* Get notification timeout from Cache-Control HTTP header
	* @returns {number} Notification timeout in milliseconds or NaN
	*/
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
	
	/**
	* Set Cache-Control max-age value
	* @param {number} value - Notification timeout in milliseconds
	*/
	set interval (value) {
		const seconds = Math.round(value / 1000);
		this.headers['CACHE-CONTROL'] = 'max-age=' + seconds;
	}
}

export default  Notification;