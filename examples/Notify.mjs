import { Protocol, Notification } from '../index.mjs';

let timeout;
const p = new Protocol();
const n = new Notification();

n.interval = 10000;
n.subject = 'urn:schemas-nore-fr:service:http:1';
n.usn = 'uuid:edb361d1-9b62-4e80-ab6a-b42f7612a30c::' + n.subject;

p.on ('notification', function (e) {
	console.debug ('FROM', e.emitter);
	console.debug (e.notification.toString ());
});

p.on ('search', function (e) {
	console.debug ('FROM', e.emitter);
	console.debug (e.search.toString ());
});

console.debug ('Persist', n.key);
p.notify (n, true);

process.on ('SIGINT', async (e) => {
	console.debug('EXIT', e);
	if (timeout) {
		console.log ('Clear timeout');
		clearTimeout (timeout);
	}
	if (p.started) {
		console.log ('Stop protocol');
		await p.stop();
	}
	console.log ('End');
});

p.start ();

timeout = setTimeout (() => {
	if (p.started) {
		p.stop();
	}
}, 360000);