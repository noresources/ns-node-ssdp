'use strict';
import { test } from 'tape';
import { Notification, PACKAGE_VERSION } from '../../index.mjs';

test('Constructor', async function (t) {
	const dflt = new Notification();
	t.true (dflt instanceof Notification, '...');
	let undef;
	const expected = {
		'type': 'ssdp:alive',
		'subject': undef,
		'usn': undef,
		'interval': 30000
	};
	for (const property in expected) {
		t.equal (dflt[property], expected[property], 'Default ' + property + ' value');
	}
	t.end();
});


test('Headers', async function (t) {
	const n = new Notification();
	const signature = 'Node.js ns-node-ssdp/' + PACKAGE_VERSION;
	n.headers.server = signature;
	
	t.true ('server' in n.headers, 'Has header');
	t.true ('SERVER' in n.headers, 'Has header (case insensitive)');
	
	t.end();
});
