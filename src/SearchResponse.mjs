/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';
import HeaderMapHandler from './HeaderMapHandler.mjs';

/**
* Search response descriptor
*/
export class SearchResponse {
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
		
		if ('S' in this.headers
				&& !('USN' in this.headers)) {
			this.headers.S = this.headers.USN;
		} else if ('USN' in this.headers
				&& !('S' in this.headers)) {
			this.headers.S = this.headers.USN;
		}
		
		for (const name of ['subject', 'usn']) {
			if (!(name in properties)) {
				continue;
			}
			this[name] = properties[name];
		}
	} // constructor
	
	/**
	* @return {string} - HTTP 200 OK message string
	*/
	toString () {
		const lines = ['HTTP/1.1 200 OK'];
		for (const k in this.headers) {
			lines.push (k + ': ' + this.headers[k]);
		}
		
		return lines.join ('\r\n') + '\r\n\r\n';
	}
	
	/**
	* Get search response subject (ST HTTP header field)
	*
	* @return {string} - Search response subject (ST HTTP header field)
	*/
	get subject () {
		return this.headers.ST;
	}

	/**
	* Set the search response subject (ST HTTP header field)
	*
	* @param {string} value - ST header field value
	*/
	set subject (value) {
		this.headers.ST = value;
	}
	
	/**
	* Get service or device USN (S and USN HTTP header field)
	*
	* @return {string} - Service or device USN (S and USN HTTP header field)
	*/
	get usn () {
		return this.headers.USN;
	}

	/**
	* Set service USN (S and USN HTTP header field)
	*
	* @param {string} value - USN and S header field value
	*/
	set usn (value) {
		this.headers.USN = value;
		this.headers.S = value;
	}
}

export default SearchResponse;