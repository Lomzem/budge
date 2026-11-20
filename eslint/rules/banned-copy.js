import { svelteCopyVisitors } from './svelte-copy.js';

const classHelpers = new Set(['cn', 'clsx']);

const isNonCopy = (node) => {
	const { parent } = node;
	if (parent.key === node || parent.source === node) return true;
	if (parent.type === 'TSExternalModuleReference') return true;
	return (
		parent.type === 'CallExpression' &&
		parent.callee.type === 'Identifier' &&
		classHelpers.has(parent.callee.name) &&
		parent.arguments.includes(node)
	);
};

export default {
	meta: {
		type: 'suggestion',
		docs: { description: 'Reject configured phrases in UI copy' },
		schema: [
			{
				type: 'object',
				properties: {
					phrases: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								pattern: { type: 'string' },
								flags: { type: 'string' },
								why: { type: 'string' },
								instead: { type: 'string' }
							},
							required: ['pattern', 'why', 'instead'],
							additionalProperties: false
						}
					}
				},
				required: ['phrases'],
				additionalProperties: false
			}
		],
		messages: {
			banned: '"{{match}}" — {{why}} {{instead}} See docs/quality/copy-review.md.'
		}
	},
	create(context) {
		const { sourceCode } = context;
		const phrases = (context.options[0]?.phrases ?? []).map(
			({ pattern, flags = '', why, instead }) => ({
				regex: new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'),
				why,
				instead
			})
		);
		const check = (texts, loc) => {
			for (const { regex, why, instead } of phrases) {
				const counts = new Map();
				for (const text of texts) {
					const inText = new Map();
					for (const [match] of text.matchAll(regex))
						inText.set(match, (inText.get(match) ?? 0) + 1);
					for (const [match, count] of inText)
						counts.set(match, Math.max(count, counts.get(match) ?? 0));
				}
				for (const [match, count] of counts) {
					for (let reported = 0; reported < count; reported += 1) {
						context.report({ loc, messageId: 'banned', data: { match, why, instead } });
					}
				}
			}
		};
		const checkLiteral = (node) => {
			if (typeof node.value === 'string' && !isNonCopy(node)) check([node.value], node.loc);
		};
		const checkQuasi = (node) => {
			if (!isNonCopy(node.parent)) check([node.value.cooked ?? node.value.raw], node.loc);
		};
		if (!sourceCode.parserServices.isSvelte) {
			return { Literal: checkLiteral, TemplateElement: checkQuasi };
		}
		return {
			...svelteCopyVisitors(
				sourceCode,
				(texts, loc) =>
					check(
						texts.map((text) => text.replace(/\s+/g, ' ')),
						loc
					),
				{ skipTitle: true }
			),
			'SvelteScriptElement Literal': checkLiteral,
			'SvelteScriptElement TemplateElement': checkQuasi
		};
	}
};
