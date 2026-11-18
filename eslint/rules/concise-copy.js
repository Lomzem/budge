import { svelteCopyVisitors } from './svelte-copy.js';

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
		return svelteCopyVisitors(context.sourceCode, (text, loc) => {
			const words = text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
			if (words <= maxWords) return;
			context.report({ loc, messageId: 'long', data: { words, maxWords } });
		});
	}
};
