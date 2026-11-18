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

export const svelteChildLists = (node) => {
	if (node.type === 'Program') return [node.body];
	if (node.type === 'SvelteAwaitBlock') {
		return [node.pending, node.then, node.catch].filter(Boolean).map((part) => part.children);
	}
	return Array.isArray(node.children) ? [node.children] : [];
};

const copyAttributes = new Set(['alt', 'aria-description', 'aria-label', 'placeholder', 'title']);

export const literalText = (expression) => {
	if (expression?.type === 'Literal' && typeof expression.value === 'string')
		return expression.value;
	if (expression?.type === 'TemplateLiteral' && expression.expressions.length === 0)
		return expression.quasis[0].value.cooked;
	return undefined;
};

const mustacheText = (node) => literalText(node.expression) ?? 'X';

const textOf = (node) => {
	if (!isInline(node)) return ' ';
	if (node.type === 'SvelteText') return node.value;
	if (node.type === 'SvelteMustacheTag') return mustacheText(node);
	return node.children.map(textOf).join('');
};

export const svelteCopyVisitors = (sourceCode, report, { skipTitle = false } = {}) => {
	const firstWord = (run) => {
		const node = run.find((child) => textOf(child).trim() !== '');
		if (node.type !== 'SvelteText') return node.loc.start;
		const leading = node.value.length - node.value.trimStart().length;
		return sourceCode.getLocFromIndex(node.range[0] + leading);
	};
	const check = (run) => {
		const text = run.map(textOf).join('');
		if (text.trim() === '') return;
		report(text, { start: firstWord(run), end: run.at(-1).loc.end });
	};
	const checkAttribute = (node) => {
		if (node.key.type !== 'SvelteName' || !copyAttributes.has(node.key.name)) return;
		const text = node.value
			.map((part) => (part.type === 'SvelteLiteral' ? part.value : mustacheText(part)))
			.join('');
		report(text, node.loc);
	};
	const visit = (node) => {
		if (node.type === 'SvelteElement' && node.kind === 'html') {
			if (inline.has(node.name.name) || (skipTitle && node.name.name === 'title')) return;
		}
		for (const children of svelteChildLists(node)) {
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
		SvelteSnippetBlock: visit,
		SvelteAttribute: checkAttribute
	};
};
