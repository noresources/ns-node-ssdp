import { Protocol } from '../index.mjs';
const SUBJECT = 'urn:schemas-depinxi-be:service:http:1';

const p = new Protocol();

p.on ('notification', function (e) {
	const n = e.notification;
	if (n.subject != SUBJECT) {
		return;
	}
	
	console.debug ('NOTIFICATION');
	console.debug (n, 'from', e.emitter);
});

process.on ('SIGINT', (e) => {
	console.debug('EXIT', e);
	if (p.started) {
		p.stop();
	}
});

p.search (SUBJECT);
p.start ();
