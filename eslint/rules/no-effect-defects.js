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
		const aliases = new Set();
		const variableOf = (node) => {
			let scope = context.sourceCode.getScope(node);
			while (scope) {
				const variable = scope.set.get(node.name);
				if (variable) return variable;
				scope = scope.upper;
			}
			return undefined;
		};
		const namespace = (node) => {
			if (node.type !== 'Identifier') return false;
			const variable = variableOf(node);
			return variable ? aliases.has(variable) : node.name === 'Effect';
		};
		const allow = context.options[0]?.allow ?? [];
		return {
			ImportSpecifier(node) {
				if (node.parent.source.value === 'effect' && node.imported.name === 'Effect')
					aliases.add(context.sourceCode.getDeclaredVariables(node)[0]);
			},
			VariableDeclarator(node) {
				if (node.id.type === 'Identifier' && node.init && namespace(node.init))
					aliases.add(context.sourceCode.getDeclaredVariables(node)[0]);
			},
			AssignmentExpression(node) {
				if (node.operator === '=' && node.left.type === 'Identifier' && namespace(node.right)) {
					const variable = variableOf(node.left);
					if (variable) aliases.add(variable);
				}
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
