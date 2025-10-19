import { Notification } from '../../index.mjs';
import { Protocol } from '../../src/platform/node/index.mjs';

const protocol = new Protocol();

const SERVICE = 'urn:schemas-nore-fr:service:Example:1';
const DEVICE_UUID = '2e0f1b12-bd53-4e14-bd32-2cc05479f82d';


const notification = new Notification ({
	'subject': SERVICE,
	// The following USN is UPnP compliant
	'usn': 'uuid:' + DEVICE_UUID + '::' + SERVICE
});

// Add a UPnP-compliant LOCATION header field
// (not mandatory for SSDP)
notification.headers.LOCATION = 'http://10.11.12.13:1234/description.xml';

protocol.notify (notification, true);

protocol.start();

process.on ('exit', () => {
	protocol.stop();
});

setTimeout(() => {
	protocol.stop();
}, 10000);
