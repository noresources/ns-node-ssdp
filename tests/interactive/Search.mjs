import { SearchRequest } from '../../index.mjs';
import { Protocol } from '../../src/platform/node/index.mjs';

const protocol = new Protocol();
const SERVICE = 'urn:schemas-nore-fr:service:Example:1';

protocol.on ('notification', (e) => {
	const n = e.notification;
	if (n.subject == SERVICE) {
		console.log ('Found', n.usn);
	}
});

const search = new SearchRequest ({
	'subject': SERVICE
});

protocol.search (search);

protocol.start();
setTimeout(() => {
	protocol.stop();
}, 10000);