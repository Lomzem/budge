const inline = new Set([
	'a',
	'abbr',
	'b',
	'code',
	'em',
	'i',
	'kbd',
	'mark',
	'small',
	'span',
	'strong',
	'time'
]);

const isInline = (node) =>
	node.type === 'SvelteText' ||
	(node.type === 'SvelteMustacheTag' && node.kind === 'text') ||
	(node.type === 'SvelteElement' && node.kind === 'html' && inline.has(node.name.name));

const childLists = (node) => {
	if (node.type === 'SvelteElement' && node.kind === 'html' && inline.has(node.name.name))
		return [];
	if (node.type === 'Program') return [node.body];
	if (node.type === 'SvelteAwaitBlock') {
		return [node.pending, node.then, node.catch].filter(Boolean).map((part) => part.children);
	}
	return Array.isArray(node.children) ? [node.children] : [];
};

export default {
	meta: {
		type: 'suggestion',
		docs: { description: 'Cap the words in one run of visible UI text' },
		schema: [
			{
				type: 'object',
				properties: {
					maxWords: { type: 'integer', minimum: 1 },
					existing: {
						type: 'array',
						items: {
							type: 'object',
							properties: { file: { type: 'string' }, text: { type: 'string' } },
							required: ['file', 'text'],
							additionalProperties: false
						}
					}
				},
				required: ['maxWords'],
				additionalProperties: false
			}
		],
		messages: {
			stale: 'Remove "{{text}}" from eslint/existing-long-copy.js; this file no longer has it.',
			long: '{{words}} words of UI copy; the limit is {{maxWords}}. Cut what the heading, control or result already says, and drop explanations of how Budge works inside. Run /unslop on it.'
		}
	},
	create(context) {
		const [{ maxWords, existing = [] }] = context.options;
		const { sourceCode } = context;
		const file = context.filename.replaceAll('\\', '/');
		const grandfathered = new Map(
			existing
				.filter((entry) => file.endsWith('/' + entry.file))
				.map((entry) => [entry.text, false])
		);
		const textOf = (node, expression) => {
			if (!isInline(node)) return ' ';
			if (node.type === 'SvelteText') return node.value;
			if (node.type === 'SvelteMustacheTag') return expression(node);
			return node.children.map((child) => textOf(child, expression)).join('');
		};
		const flatten = (run, expression) =>
			run
				.map((node) => textOf(node, expression))
				.join('')
				.replace(/\s+/g, ' ')
				.trim();
		const check = (run) => {
			if (run.length === 0) return;
			const text = flatten(run, (node) => sourceCode.getText(node));
			const words = flatten(run, () => 'X')
				.split(' ')
				.filter((word) => /\p{L}/u.test(word)).length;
			if (grandfathered.has(text)) grandfathered.set(text, true);
			if (words <= maxWords || grandfathered.has(text)) return;
			context.report({
				loc: { start: run[0].loc.start, end: run.at(-1).loc.end },
				messageId: 'long',
				data: { words, maxWords }
			});
		};
		const visit = (node) => {
			for (const children of childLists(node)) {
				let run = [];
				for (const child of children) {
					if (isInline(child)) {
						run.push(child);
						continue;
					}
					check(run);
					run = [];
				}
				check(run);
			}
		};
		return {
			Program: visit,
			'Program:exit'() {
				for (const [text, seen] of grandfathered) {
					if (!seen)
						context.report({ loc: { line: 1, column: 0 }, messageId: 'stale', data: { text } });
				}
			},
			SvelteElement: visit,
			SvelteIfBlock: visit,
			SvelteElseBlock: visit,
			SvelteEachBlock: visit,
			SvelteAwaitBlock: visit,
			SvelteKeyBlock: visit,
			SvelteSnippetBlock: visit
		};
	}
};
