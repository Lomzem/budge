const directive =
	/^\s*eslint-disable(-next-line|-line)?(?:\s+(?!--)(.+?))?\s*(?:--\s*([\s\S]*?))?\s*$/;
const inlineConfig = /^\s*eslint\s+([\s\S]+)$/;
const terms = /^(.+?); expires (\d{4}-\d{2}-\d{2}); approved by (\S.*)$/;

function isCalendarDate(text) {
	const date = new Date(`${text}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export default {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: { rules: { type: 'array', items: { type: 'string' }, minItems: 1 } },
				required: ['rules'],
				additionalProperties: false
			}
		],
		messages: {
			terms:
				'An exception to {{rule}} reads `-- <reason>; expires YYYY-MM-DD; approved by <owner>`, and the owner approves it first.',
			expired:
				'The exception to {{rule}} expired on {{date}}. Fix the code, or get the owner to approve a new date.',
			date: 'The exception to {{rule}} expires on {{date}}, which is not a calendar date. Write YYYY-MM-DD.',
			blanket:
				'A blanket `eslint-disable` also silences {{rules}}. Disable one named rule for one line: `eslint-disable-next-line <rule> -- <reason>; expires YYYY-MM-DD; approved by <owner>`.',
			line: 'An exception to {{rule}} covers one line. Write `eslint-disable-next-line {{rule}} -- <reason>; expires YYYY-MM-DD; approved by <owner>` above it.'
		}
	},
	create(context) {
		const options = context.options[0].rules;
		const guarded = new Set(options);
		const today = new Date().toISOString().slice(0, 10);
		const named = (list) =>
			list
				.split(',')
				.map((name) => name.trim().split(/[\s:]/)[0])
				.find((name) => guarded.has(name));
		const check = (node, text) => {
			const config = inlineConfig.exec(text);
			if (config && !/^\s*eslint-/.test(text)) {
				const rule = options.find((name) => config[1].includes(name));
				if (rule) context.report({ node, messageId: 'line', data: { rule } });
				return;
			}
			const match = directive.exec(text);
			if (!match) return;
			const [, scope, list, reason] = match;
			if (list === undefined)
				return context.report({ node, messageId: 'blanket', data: { rules: options.join(', ') } });
			const rule = named(list);
			if (!rule) return;
			if (scope === undefined) return context.report({ node, messageId: 'line', data: { rule } });
			const agreed = terms.exec(reason ?? '');
			if (!agreed) return context.report({ node, messageId: 'terms', data: { rule } });
			const date = agreed[2];
			if (!isCalendarDate(date))
				return context.report({ node, messageId: 'date', data: { rule, date } });
			if (date < today) context.report({ node, messageId: 'expired', data: { rule, date } });
		};
		return {
			Program() {
				for (const comment of context.sourceCode.getAllComments()) check(comment, comment.value);
			},
			SvelteHTMLComment(node) {
				check(node, node.value);
			}
		};
	}
};
