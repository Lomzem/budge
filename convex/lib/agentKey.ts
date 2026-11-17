const BEARER = /^Bearer (\S+)$/;

export async function admitsAgentKey(
	authorization: string | null,
	fingerprint: string | undefined
) {
	if (fingerprint === undefined || fingerprint === '' || authorization === null) return false;
	const key = BEARER.exec(authorization)?.[1];
	if (key === undefined) return false;
	return sameText(await sha256Hex(key), fingerprint.trim().toLowerCase());
}

async function sha256Hex(text: string) {
	const digest = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
	);
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sameText(a: string, b: string) {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index += 1) {
		difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}
	return difference === 0;
}
