/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';
export default {
	has (o, p) {
		if (Reflect.has(o, p)) {
			return true;
		}
		
		if (typeof (p) != 'string') {
			return false;
		}
		
		const up = p.toUpperCase();
		for (const k in o) {
			if (k.toUpperCase() == up) {
				return true;
			}
		}
		return false;
	},
	
	get (o, p) {
		if (Reflect.has(o, p)) {
			return Reflect.get (...arguments);
		}
		
		if (typeof (p) != 'string') {
			return;
		}

		const up = p.toUpperCase();
		for (const h in o) {
			if (h.toUpperCase() == up) {
				return Reflect.get (o, h);
			}
		}
	}, // get
	
	set (o, p, v) {
		if (Reflect.has(o, p)) {
			return Reflect.set (...arguments);
		}
		
		if (typeof (p) != 'string') {
			return Reflect.set (...arguments);
		}
		
		const up = p.toUpperCase();
		for (const k in o) {
			if (k.toUpperCase() == up) {
				return Reflect.set (o, k, v);
			}
		}
		
		return Reflect.set (...arguments);
	},
	
	deleteProperty (o, p) {
		if (Reflect.has(o, p)) {
			return Reflect.deleteProperty (...arguments);
		}
		
		if (typeof (p) != 'string') {
			return false;
		}
		
		const up = p.toUpperCase();
		for (const h in o) {
			if (h.toUpperCase() == up) {
				return Reflect.deleteProperty (o, h);
			}
		}
		return false;
	} // deleteProperty
};