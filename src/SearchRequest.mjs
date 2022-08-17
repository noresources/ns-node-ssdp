/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';
import HeaderMapHandler from './HeaderMapHandler.mjs';

export const SEARCH_ALL = 'ssdp:all';

/**
* Search request descriptor
*/
export class SearchRequest {
	/**
	* @param {Object} properties - Notification properties
	* @param {Object} headers - Custom message headers
	*/
	constructor (properties, headers) {

		if (typeof (properties) == 'string') {
			properties = {
				'subject': properties
			};
		}

		if (!(typeof (properties) == 'object' && properties)) {
			properties = {};
		}
				
		if (!(typeof (headers) == 'object' && headers)) {
			headers = {};
		}
			
		this.headers = new Proxy (headers, HeaderMapHandler);
		
		if (!('MAN' in this.headers)) {
			this.headers.MAN = '"ssdp:discover"';
		}
		
		if (!('MX' in this.headers)) {
			this.headers.MX = 1;
		}
		if (!('ST' in this.headers)) {
			this.headers.ST = SEARCH_ALL;
		}
		
		for (const name of ['subject']) {
			if (!(name in properties)) {
				continue;
			}
			this[name] = properties[name];
		}
	} // constructor
	
	/**
	* Get SSDP message text
	* @returns {string}
	*/
	toString () {
		const lines = ['M-SEARCH * HTTP/1.1'];
		for (const k in this.headers) {
			lines.push (k + ': ' + this.headers[k]);
		}
		
		return lines.join ('\r\n') + '\r\n\r\n';
	}
	
	/**
	* Get search request subject (ST HTTP header field)
	* @returns {string}
	*/
	get subject () {
		return this.headers.ST;
	}

	/**
	* @param {string} value - ST header field value
	*/
	set subject (value) {
		this.headers.ST = value;
	}
}

export default  SearchRequest;