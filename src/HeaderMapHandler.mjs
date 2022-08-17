'use strict';
export default {
	has (o, p) {
		if (Reflect.has(o, p)) {
			return true;
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
		
		const up = p.toUpperCase();
		for (const k in o) {
			if (k.toUpperCase() == up) {
				return Reflect.set (o, k, v);
			}
		}
		
		return Reflect.set (...arguments);
	}
};