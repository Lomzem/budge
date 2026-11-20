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

export const shownTexts = (expression) => {
	const text = literalText(expression);
	if (text !== undefined) return [text];
	if (expression?.type === 'TemplateLiteral')
		return [expression.quasis.map((quasi) => quasi.value.cooked).join('X')];
	if (expression?.type === 'ConditionalExpression')
		return [...shownTexts(expression.consequent), ...shownTexts(expression.alternate)];
	if (expression?.type === 'LogicalExpression') {
		const left = expression.operator === '&&' ? [''] : shownTexts(expression.left);
		return [...left, ...shownTexts(expression.right)];
	}
	return ['X'];
};

const mostVariants = 32;

const allCombinations = (parts) =>
	parts.reduce(
		(texts, part) => texts.flatMap((text) => part.map((variant) => text + variant)),
		['']
	);

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

const longest = (variants) =>
	variants.reduce((most, variant) => (wordCount(variant) > wordCount(most) ? variant : most));

const eachVariantInContext = (parts) => {
	const usual = parts.map(([first]) => first);
	const withOne = (index, variant) =>
		usual.map((text, other) => (other === index ? variant : text)).join('');
	return [
		parts.map(longest).join(''),
		...parts.flatMap((part, index) => part.map((variant) => withOne(index, variant)))
	];
};

const joined = (parts) =>
	parts.reduce((count, part) => count * part.length, 1) <= mostVariants
		? allCombinations(parts)
		: eachVariantInContext(parts);

const textsOf = (node) => {
	if (!isInline(node)) return [' '];
	if (node.type === 'SvelteText') return [node.value];
	if (node.type === 'SvelteMustacheTag') return shownTexts(node.expression);
	return joined(node.children.map(textsOf));
};

export const svelteCopyVisitors = (sourceCode, report, { skipTitle = false } = {}) => {
	const firstWord = (run) => {
		const node = run.find((child) => textsOf(child).some((text) => text.trim() !== ''));
		if (node.type !== 'SvelteText') return node.loc.start;
		const leading = node.value.length - node.value.trimStart().length;
		return sourceCode.getLocFromIndex(node.range[0] + leading);
	};
	const check = (run) => {
		const texts = [...new Set(joined(run.map(textsOf)))].filter((text) => text.trim() !== '');
		if (texts.length === 0) return;
		report(texts, { start: firstWord(run), end: run.at(-1).loc.end });
	};
	const checkAttribute = (node) => {
		if (node.key.type !== 'SvelteName' || !copyAttributes.has(node.key.name)) return;
		const texts = joined(
			node.value.map((part) =>
				part.type === 'SvelteLiteral' ? [part.value] : shownTexts(part.expression)
			)
		);
		report([...new Set(texts)], node.loc);
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
