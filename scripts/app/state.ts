import { chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function stateDir(checkout: string) {
	const dir = join(checkout, '.local-app');
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	return dir;
}

export function storageStatePath(checkout: string) {
	return join(stateDir(checkout), 'storage-state.json');
}

export function keepPrivate(path: string) {
	chmodSync(path, 0o600);
}
