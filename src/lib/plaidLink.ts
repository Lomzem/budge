const SCRIPT_URL = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
const LOAD_TIMEOUT_MS = 15_000;

interface LinkHandler {
	open: () => void;
	destroy: () => void;
}

interface PlaidLink {
	create: (config: {
		token: string;
		onSuccess: (
			publicToken: string,
			metadata: { institution?: { name?: string | null } | null } | null
		) => void;
		onExit: (error: { error_code: string } | null) => void;
	}) => LinkHandler;
}

declare global {
	interface Window {
		Plaid?: PlaidLink;
	}
}

let loading: Promise<PlaidLink | null> | undefined;

function loadLink(): Promise<PlaidLink | null> {
	loading ??= new Promise<PlaidLink | null>((resolve) => {
		const script = document.createElement('script');
		const settle = (plaid: PlaidLink | null) => {
			clearTimeout(timeout);
			if (plaid === null) script.remove();
			resolve(plaid);
		};
		const timeout = setTimeout(() => {
			settle(null);
		}, LOAD_TIMEOUT_MS);
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			settle(window.Plaid ?? null);
		};
		script.onerror = () => {
			settle(null);
		};
		document.head.append(script);
	}).then((plaid) => {
		if (plaid === null) loading = undefined;
		return plaid;
	});
	return loading;
}

export interface Linked {
	kind: 'linked';
	publicToken: string;
	institutionName: string | undefined;
}

export async function openPlaidLink(token: string): Promise<Linked | 'exit' | 'unavailable'> {
	const plaid = await loadLink();
	if (plaid === null) return 'unavailable';
	return await new Promise((resolve) => {
		const handler = plaid.create({
			token,
			onSuccess: (publicToken, metadata) => {
				handler.destroy();
				resolve({
					kind: 'linked',
					publicToken,
					institutionName: metadata?.institution?.name ?? undefined
				});
			},
			onExit: () => {
				handler.destroy();
				resolve('exit');
			}
		});
		handler.open();
	});
}
