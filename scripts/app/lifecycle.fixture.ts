import { join } from 'node:path';

import { spawnLogged } from '../local/logged';
import { startOwned, withAppStartup } from './owned';

const [checkout = process.cwd()] = process.argv.slice(2);
await withAppStartup(checkout, async () => {
	const urls = { appUrl: 'http://127.0.0.1:5999', backendUrl: 'http://127.0.0.1:3999' };
	for (const role of ['backend', 'vite'] as const) {
		const child = await startOwned(checkout, urls, role, () =>
			spawnLogged({
				command: ['sleep', '300'],
				cwd: checkout,
				env: process.env,
				logPath: join(checkout, '.local-app', `${role}.log`)
			})
		);
		child.unref();
		if (role === 'backend') {
			console.log('backend started; waiting for startup to continue');
			await new Promise<void>((resolve) =>
				process.stdin.once('data', () => {
					resolve();
				})
			);
			process.stdin.pause();
		}
	}
	return urls;
});
