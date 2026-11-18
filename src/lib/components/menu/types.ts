export type MenuEntry =
	| { kind: 'item'; label: string; run: () => void; destructive?: boolean; disabled?: boolean }
	| { kind: 'sub'; label: string; items: { key: string; label: string; run: () => void }[] }
	| { kind: 'separator' };
