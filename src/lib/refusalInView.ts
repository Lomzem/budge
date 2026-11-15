import type { Attachment } from 'svelte/attachments';

export const keepRefusalInView: Attachment<HTMLElement> = (message) => {
	const row = message.parentElement ?? message;
	const focused = document.activeElement;
	const elsewhere = focused !== null && focused !== document.body && !row.contains(focused);
	(elsewhere ? focused : row).scrollIntoView({ block: 'nearest' });
};
