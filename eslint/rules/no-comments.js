const directive =
	/^(?:eslint-disable(?:-line|-next-line)?|eslint-enable|@ts-expect-error|@effect-diagnostics|prettier-ignore|svelte-ignore)(?=$|\s)/;

const isDirective = (text) => directive.test(text.trim());

const styleCommentLoc = (comment) => ({
	start: { line: comment.source.start.line, column: comment.source.start.column - 1 },
	end: { line: comment.source.end.line, column: comment.source.end.column }
});

export default {
	meta: {
		type: 'suggestion',
		docs: { description: 'Disallow comments other than tool directives' },
		schema: [],
		messages: {
			comment:
				'Move this fact into code (a name, constant, type, or helper), a test name, or an ADR or the glossary; or delete it.'
		}
	},
	create(context) {
		const { sourceCode } = context;
		const report = (loc) => {
			context.report({ loc, messageId: 'comment' });
		};
		return {
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					if (!isDirective(comment.value)) report(comment.loc ?? sourceCode.getLoc(comment));
				}
				const style = sourceCode.parserServices.getStyleContext?.();
				if (style?.status !== 'success') return;
				style.sourceAst.walkComments((comment) => {
					if (!isDirective(comment.text)) report(styleCommentLoc(comment));
				});
			},
			SvelteHTMLComment(node) {
				if (!isDirective(node.value)) report(node.loc);
			}
		};
	}
};
