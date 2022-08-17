'use strict';
import { test } from 'tape';
import { Notification } from '../../index.mjs';

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

test('Update interval', async function (t) {
	const n = new Notification();
	t.equal (n.interval, 30000, 'Default interval property');
	t.equal (n.headers['cache-control'], 'max-age=30', 'Default cache-control');
	
	t.pass ('Set interval from property');
	n.interval = 5000;
	t.equal (n.interval, 5000, 'User-defined interval property');
	t.equal (n.headers['cache-control'], 'max-age=5', 'cache-control from user-defined property');
	
	t.end();
});

test('Headers', async function (t) {
	const n = new Notification();
	const signature = 'Node.js ns-node-ssdp/' + '1.2.3';
	n.headers.server = signature;
	
	t.true ('server' in n.headers, 'Has header');
	t.true ('SERVER' in n.headers, 'Has header (case insensitive)');
	
	t.end();
});
