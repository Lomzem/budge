import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

const CLERK_REFRESH_SESSION_AND_BROWSER_TOKENS = [
	/__clerk_db_jwt=[^&\s]+/g,
	/\b(sess|dvb|sk_test|sk_live)_[A-Za-z0-9]+/g,
	/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g
];

const knownSecrets = new Set<string>();

export function treatAsSecret(values: Iterable<string>) {
	for (const value of values) if (value !== '') knownSecrets.add(value);
}

export function redact(text: string) {
	let redacted = text;
	for (const value of knownSecrets) redacted = redacted.replaceAll(value, '<redacted>');
	for (const pattern of CLERK_REFRESH_SESSION_AND_BROWSER_TOKENS)
		redacted = redacted.replace(pattern, '<redacted>');
	return redacted;
}

export function redactInto(source: Readable, target: Writable) {
	createInterface({ input: source, crlfDelay: Infinity }).on('line', (line) => {
		target.write(`${redact(line)}\n`);
	});
}
