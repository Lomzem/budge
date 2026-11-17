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

const textOf = (node) => {
	if (!isInline(node)) return ' ';
	if (node.type === 'SvelteText') return node.value;
	if (node.type === 'SvelteMustacheTag') return 'X';
	return node.children.map(textOf).join('');
};

export default {
	meta: {
		type: 'suggestion',
		docs: { description: 'Cap the words in one run of visible UI text' },
		schema: [
			{
				type: 'object',
				properties: {
					maxWords: { type: 'integer', minimum: 1 }
				},
				required: ['maxWords'],
				additionalProperties: false
			}
		],
		messages: {
			long: '{{words}} words of UI copy; the limit is {{maxWords}}. Cut what the heading, control or result already says, and drop explanations of how Budge works inside. Run /unslop on it.'
		}
	},
	create(context) {
		const [{ maxWords }] = context.options;
		const flatten = (run) => run.map(textOf).join('').replace(/\s+/g, ' ').trim();
		const check = (run) => {
			if (run.length === 0) return;
			const words = flatten(run)
				.split(' ')
				.filter((word) => /\p{L}/u.test(word)).length;
			if (words <= maxWords) return;
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
