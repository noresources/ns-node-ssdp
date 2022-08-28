# ns-node-ssdp
SSDP protocol implementation for Node.js

## Usable examples

### Advertise

```javascript

import { Protocol, Notification } from "ns-node-ssdp"

const protocol = new Protocol()

const SERVICE = "urn:schemas-nore-fr:service:Example:1"
const DEVICE_UUID = "2e0f1b12-bd53-4e14-bd32-2cc05479f82d"
const notification = new Notification ({
	subject: SERVICE,
	usn: "uuid:" + DEVICE_UUID + "::" + SERVICE
})

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

## References
* [SSDP draft v1.03](https://datatracker.ietf.org/doc/html/draft-cai-ssdp-v1-03)

## See also
* [node-ssdp, Another SSDP module](https://github.com/diversario/node-ssdp)
