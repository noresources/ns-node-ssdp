import { Protocol, Notification } from '../index.mjs';

let timeout;
const p = new Protocol();
const n = new Notification();

n.interval = 2000;
n.subject = 'urn:schemas-nore-fr:service:Test:1';
n.usn = 'uuid:edb361d1-9b62-4e80-ab6a-b42f7612a30c::' + n.subject;

console.debug ("Original notification\n", n.toString())

p.on ('notification', function (e) {
	console.debug ('FROM', e.emitter);
	console.debug (e.notification.toString ());
});

console.debug ('Persist', n.key);
p.notify (n, true);

process.on ('SIGINT', (e) => {
	console.debug('EXIT', e);
	if (timeout) {
		clearTimeout (timeout);
	}
	if (p.started) {
		p.stop();
	}
});

p.start ();

timeout = setTimeout (() => {
	if (p.started) {
		p.stop();
	}
}, 30000);