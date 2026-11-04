import { execFileSync, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';

import { stateDir } from './state';

async function acquire(fd: number) {
	try {
		execFileSync('flock', ['--exclusive', '--nonblock', '3'], {
			stdio: ['ignore', 'ignore', 'pipe', fd]
		});
		return;
	} catch (error) {
		if ((error as { status?: number }).status !== 1) {
			throw new Error('app lifecycle locking requires the util-linux flock command.', {
				cause: error
			});
		}
	}
	console.log('app: waiting for another lifecycle command in this checkout…');
	await new Promise<void>((resolve, reject) => {
		const child = spawn('flock', ['--exclusive', '3'], {
			stdio: ['ignore', 'ignore', 'inherit', fd]
		});
		child.once('error', reject);
		child.once('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error('could not acquire the app lifecycle lock'));
		});
	});
}

export async function withLifecycleLock<T>(checkout: string, operation: () => Promise<T>) {
	const fd = openSync(join(stateDir(checkout), 'lifecycle.lock'), 'a', 0o600);
	try {
		await acquire(fd);
		return await operation();
	} finally {
		closeSync(fd);
	}
}
