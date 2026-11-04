import { createServer } from 'node:net';

import { claimBackendPorts } from './backend';
import { freePort } from './processes';

async function ephemeralPort() {
	const server = createServer();
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = server.address();
	if (address === null || typeof address === 'string') throw new Error('missing port binding');
	const port = address.port;
	await new Promise<void>((resolve, reject) =>
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		})
	);
	return port;
}

export async function claimE2EPorts(dir: string) {
	const backend = await claimBackendPorts(dir, await ephemeralPort());
	const preview = await freePort(await ephemeralPort(), [backend.cloud, backend.site]);
	return { ...backend, preview };
}
