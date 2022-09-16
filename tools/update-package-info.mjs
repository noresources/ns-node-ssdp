import * as fs from 'fs';

const info = JSON.parse (fs.readFileSync ('package.json').toString());
const text = 'const PACKAGE = {\n'
	+ '	\'NAME\': \''+info.name+'\',\n'
	+ '	\'VERSION\': \''+info.version+'\'\n'
	+ '};\n'
	+ 'export default PACKAGE;\n';
	
fs.writeFileSync('src/Package.mjs', text);