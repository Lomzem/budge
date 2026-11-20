import { shownTexts, svelteChildLists } from './svelte-copy.js';

const isHeading = (node) => node.kind === 'html' && /^h[1-3]$/.test(node.name.name);

const classOf = (node) =>
	node.startTag.attributes
		.filter((attribute) => attribute.type === 'SvelteAttribute' && attribute.key.name === 'class')
		.flatMap((attribute) => attribute.value)
		.map((part) => (part.type === 'SvelteLiteral' ? part.value : ''))
		.join(' ');

const muted = 'text-muted-foreground';

const isMuted = (node) =>
	new RegExp(`(^|\\s)${muted}(\\s|$)`).test(classOf(node)) ||
	node.startTag.attributes.some(
		(attribute) =>
			attribute.type === 'SvelteDirective' &&
			attribute.kind === 'Class' &&
			attribute.key.name.name === muted
	);

const isWhitespace = (node) => node.type === 'SvelteText' && node.value.trim() === '';

const staticText = (node) => {
	if (node.type === 'SvelteText') return node.value;
	if (node.type === 'SvelteMustacheTag') return shownTexts(node.expression).join(' ');
	if (node.type === 'SvelteSnippetBlock') return ' ';
	const branches = node.else ? [staticText(node.else)] : [];
	return [
		...svelteChildLists(node).map((children) => children.map(staticText).join('')),
		...branches
	].join(' ');
};

const sentence = /[\p{L}\p{N}][.!]["”’)]?(\s|$)/u;

const isLede = (node) =>
	node.kind === 'html' &&
	node.name.name === 'p' &&
	isMuted(node) &&
	sentence.test(staticText(node));

export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Reject a muted explanatory sentence right under a page or section heading'
		},
		schema: [],
		messages: {
			lede: 'Text under a heading explains instead of acting. Delete it, or move what the person needs next to the control it is about. See docs/quality/copy-review.md.'
		}
	},
	create(context) {
		return {
			SvelteElement(node) {
				if (!isHeading(node)) return;
				const siblings = node.parent.children ?? node.parent.body;
				const next = siblings.find(
					(sibling) =>
						sibling.range[0] >= node.range[1] &&
						sibling.type !== 'SvelteHTMLComment' &&
						!isWhitespace(sibling)
				);
				if (next?.type === 'SvelteElement' && isLede(next)) {
					context.report({ node: next, messageId: 'lede' });
				}
			}
		};
	}
};
