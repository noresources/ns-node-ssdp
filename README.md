# ns-node-ssdp
SSDP protocol implementation for Node.js

This project aims to provide a "pure" SSDP implementation.
It can be used as a base for UPnP service discovery protocol
implementation but also for vendor specific protocols.

## Examples

### Advertise

```javascript

import { Protocol, Notification } from "ns-node-ssdp"

const protocol = new Protocol()

const SERVICE = "urn:schemas-nore-fr:service:Example:1"
const DEVICE_UUID = "2e0f1b12-bd53-4e14-bd32-2cc05479f82d"


const notification = new Notification ({
	subject: SERVICE,
	// The following USN is UPnP compliant
	usn: "uuid:" + DEVICE_UUID + "::" + SERVICE
})

// Add a UPnP-compliant LOCATION header field
// (not mandatory for SSDP)
notification.headers.LOCATION = 'http://10.11.12.13:1234/description.xml";

protocol.notify (notification, true)

protocol.start()

process.on ("exit", () => {
	protocol.stop()
})
```

### Search and watch

```javascript
import { Protocol, SearchRequest } from "ns-node-ssdp"

const protocol = new Protocol()
const SERVICE = "urn:schemas-nore-fr:service:Example:1"

protocol.on ("notification", (e) {
	const n = e.notification
	if (n.subject == SERVICE)
		console.log ("Found", n.usn)
})

const search = new SearchRequest ({
	subject: SERVICE
})

protocol.search (search)

```

## Documentation

See the [JSDoc generated documentation](http://ssdp.node.sources.nore.fr/).

## References
* [SSDP draft v1.03](https://datatracker.ietf.org/doc/html/draft-cai-ssdp-v1-03)

## See also
* [node-ssdp](https://github.com/diversario/node-ssdp). Another SSDP module
* [ns-dotnet-ssdp](https://github.com/noresources/ns-dotnet-ssdp). A .Net implementation with similar API and features.
