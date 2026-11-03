const defects = new Set(['die', 'dieMessage', 'orDie', 'orDieWith']);

export default {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: {
					allow: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								file: { type: 'string' },
								className: { type: 'string' },
								method: { type: 'string' },
								reason: { type: 'string', minLength: 1 }
							},
							required: ['file', 'className', 'method', 'reason'],
							additionalProperties: false
						}
					}
				},
				additionalProperties: false
			}
		],
		messages: {
			defect:
				'Keep boundary failures in the Effect error channel; defects require an approved invariant boundary.'
		}
	},
	create(context) {
		const names = new Set(['Effect']);
		const allow = context.options[0]?.allow ?? [];
		return {
			ImportSpecifier(node) {
				if (node.parent.source.value === 'effect' && node.imported.name === 'Effect')
					names.add(node.local.name);
			},
			MemberExpression(node) {
				const property = node.computed ? node.property.value : node.property.name;
				if (!names.has(node.object.name) || !defects.has(property)) return;
				const ancestors = context.sourceCode.getAncestors(node);
				const method = ancestors.findLast((ancestor) => ancestor.type === 'MethodDefinition');
				const owner = ancestors.findLast((ancestor) => ancestor.type === 'ClassDeclaration');
				const approved = allow.some(
					(entry) =>
						context.filename.replaceAll('\\', '/').endsWith('/' + entry.file) &&
						owner?.id?.name === entry.className &&
						method?.static === true &&
						method.key.name === entry.method
				);
				if (!approved) context.report({ node, messageId: 'defect' });
			}
		};
	}
};
