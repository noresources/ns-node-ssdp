/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';

import * as fs from 'fs';

const info = JSON.parse (fs.readFileSync ('package.json').toString());
const text = `
/*
 * Copyright © 2022 by Renaud Guillard (dev@nore.fr)
 * Distributed under the terms of the MIT License, see LICENSE
 */
 
'use strict';

const PACKAGE = {
		"NAME": "${info.name}",
		"VERSION": "${info.version}"
	
};
export { PACKAGE };
export default PACKAGE;
`;

fs.writeFileSync('src/Package.mjs', text);