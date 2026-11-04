import { createServer, type Server } from 'node:net';
import { claimE2EPorts } from './e2e-ports';

const ports = await claimE2EPorts(process.cwd());
const servers: Server[] = [];
await Promise.all(
	Object.values(ports).map((port) => {
		const server = createServer();
		servers.push(server);
		return new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(port, '127.0.0.1', resolve);
		});
	})
);
console.log(JSON.stringify(ports));
process.stdin.once('data', () => {
	for (const server of servers) server.close();
	process.stdin.destroy();
});
