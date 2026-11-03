import { execFileSync } from 'node:child_process';

import { findCheckout } from '../local/checkout';
import { withLifecycleLock } from './lock';
import { readRunningApp, stopRecordedApp } from './owned';
import type { Verb } from './verb';

export const down: Verb = {
	usage: 'bun run app down',
	summary: 'Stop the backend and Vite that `up` started.',
	details:
		"Keeps the backend's data in .convex/local and restores SvelteKit's generated types. Running it again changes nothing.",
	run: async () => {
		const { checkout } = findCheckout();
		await withLifecycleLock(checkout, async () => {
			const running = readRunningApp(checkout);
			if (running === undefined) {
				console.log('app: already down.');
				return;
			}
			await stopRecordedApp(checkout);
			execFileSync(process.execPath, ['run', 'sync'], { cwd: checkout, stdio: 'ignore' });
			console.log('app: down.');
		});
	}
};
