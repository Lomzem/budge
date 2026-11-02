// Plaid Link in the browser, for Reconnect. Plaid requires its script straight from its CDN, so it
// loads on first use rather than from the bundle.

const SCRIPT_URL = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

interface LinkHandler {
	open: () => void;
	destroy: () => void;
}

interface PlaidLink {
	create: (config: {
		token: string;
		onSuccess: (publicToken: string | null) => void;
		onExit: (error: { error_code: string } | null) => void;
	}) => LinkHandler;
}

declare global {
	interface Window {
		Plaid?: PlaidLink;
	}
}

let loading: Promise<PlaidLink> | undefined;

function loadLink(): Promise<PlaidLink> {
	loading ??= new Promise<PlaidLink>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			if (window.Plaid) resolve(window.Plaid);
			else reject(new Error('Plaid Link did not load'));
		};
		script.onerror = () => {
			reject(new Error('Plaid Link did not load'));
		};
		document.head.append(script);
	}).catch((error: unknown) => {
		// A failed load can be tried again.
		loading = undefined;
		throw error;
	});
	return loading;
}

/**
 * Opens Plaid Link with a Link token and settles when the owner finishes: `success` once Plaid has
 * the new login or consent, `exit` if they closed Link first. In update mode there is no public
 * token to exchange, since the Item and its access token stay the same.
 */
export async function openPlaidLink(token: string): Promise<'success' | 'exit'> {
	const plaid = await loadLink();
	return await new Promise((resolve) => {
		const handler = plaid.create({
			token,
			onSuccess: () => {
				handler.destroy();
				resolve('success');
			},
			onExit: () => {
				handler.destroy();
				resolve('exit');
			}
		});
		handler.open();
	});
}
