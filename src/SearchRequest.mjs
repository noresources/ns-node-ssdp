/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';
import HeaderMapHandler from './HeaderMapHandler.mjs';

/**
 * Special search subject to query all devices and srevices
 */
export const SEARCH_ALL = 'ssdp:all';

/**
* Search request descriptor
*
* Describe content of a M-SEARCH message
*/
export class SearchRequest {
	/**
	* @param {object|string} properties - Request properties.
	* 	If a {string} is given, assumes it represents the search subject.
	* @param {object} headers - User-defined message header fields.
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
	*
	* @return {string} M-SEARCH message
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
	*
	* @return {string}
	*/
	get subject () {
		return this.headers.ST;
	}

	/**
	* Set search request subject (ST HTTP header field)
	*
	* @param {string} value - ST header field value
	*/
	set subject (value) {
		this.headers.ST = value;
	}
}

export default  SearchRequest;