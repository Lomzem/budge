import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function git(cwd: string, ...args: string[]) {
	return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

export function findCheckout(cwd = process.cwd()) {
	const checkout = git(cwd, 'rev-parse', '--show-toplevel').trim();
	const mainCheckout = dirname(
		git(checkout, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim()
	);
	return { checkout, mainCheckout };
}

export function requireInstalled(checkout: string) {
	if (!existsSync(join(checkout, 'node_modules'))) {
		throw new Error('run `bun install` in this checkout first.');
	}
}

export function copyCheckout(checkout: string, workdir: string) {
	const files = git(checkout, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')
		.split('\0')
		.filter(Boolean);
	for (const file of files) {
		const source = join(checkout, file);
		if (!existsSync(source)) continue;
		mkdirSync(dirname(join(workdir, file)), { recursive: true });
		cpSync(source, join(workdir, file), { verbatimSymlinks: true });
	}
	symlinkSync(join(checkout, 'node_modules'), join(workdir, 'node_modules'), 'dir');
}
