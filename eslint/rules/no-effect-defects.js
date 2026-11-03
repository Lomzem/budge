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
		const aliases = new Set();
		const namespace = (node) => {
			if (node.type !== 'Identifier') return false;
			if (names.has(node.name)) return true;
			let scope = context.sourceCode.getScope(node);
			while (scope) {
				const variable = scope.set.get(node.name);
				if (variable) return aliases.has(variable);
				scope = scope.upper;
			}
			return false;
		};
		const allow = context.options[0]?.allow ?? [];
		return {
			ImportSpecifier(node) {
				if (node.parent.source.value === 'effect' && node.imported.name === 'Effect')
					names.add(node.local.name);
			},
			VariableDeclarator(node) {
				if (node.id.type === 'Identifier' && node.init && namespace(node.init))
					aliases.add(context.sourceCode.getDeclaredVariables(node)[0]);
			},
			MemberExpression(node) {
				const property = node.computed ? node.property.value : node.property.name;
				if (!namespace(node.object) || !defects.has(property)) return;
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
