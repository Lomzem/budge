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

let loading: Promise<PlaidLink | null> | undefined;

function loadLink(): Promise<PlaidLink | null> {
	loading ??= new Promise<PlaidLink | null>((resolve) => {
		const script = document.createElement('script');
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => {
			resolve(window.Plaid ?? null);
		};
		script.onerror = () => {
			resolve(null);
		};
		document.head.append(script);
	}).then((plaid) => {
		if (plaid === null) loading = undefined;
		return plaid;
	});
	return loading;
}

export async function openPlaidLink(token: string): Promise<'success' | 'exit' | 'unavailable'> {
	const plaid = await loadLink();
	if (plaid === null) return 'unavailable';
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
