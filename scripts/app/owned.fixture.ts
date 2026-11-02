import { join } from 'node:path';

import { spawnLogged } from '../local/logged';
import { startOwned, stopOnInterrupt } from './owned';

const [checkout = process.cwd(), ...command] = process.argv.slice(2);
stopOnInterrupt(checkout);
await startOwned(
	checkout,
	{ appUrl: 'http://127.0.0.1:5999', backendUrl: 'http://127.0.0.1:3999' },
	'backend',
	() =>
		spawnLogged({
			command: command.length > 0 ? command : ['sleep', '300'],
			cwd: checkout,
			env: process.env,
			logPath: join(checkout, '.local-app', 'backend.log')
		})
);
console.log('started');
setInterval(() => undefined, 60_000);
