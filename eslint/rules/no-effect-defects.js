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
		const effectPackageNamespaces = new Set();
		const importedDefectFunctions = new Set();
		const propertyName = (node) => (node.computed ? node.property.value : node.property.name);
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
			if (node.type === 'MemberExpression') {
				return (
					propertyName(node) === 'Effect' &&
					node.object.type === 'Identifier' &&
					effectPackageNamespaces.has(variableOf(node.object))
				);
			}
			if (node.type !== 'Identifier') return false;
			const variable = variableOf(node);
			return variable ? aliases.has(variable) : node.name === 'Effect';
		};
		const allow = context.options[0]?.allow ?? [];
		const checkDefect = (node) => {
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
		};
		return {
			ImportNamespaceSpecifier(node) {
				const source = node.parent.source.value;
				const variable = context.sourceCode.getDeclaredVariables(node)[0];
				if (source === 'effect') effectPackageNamespaces.add(variable);
				if (source === 'effect/Effect') aliases.add(variable);
			},
			ImportSpecifier(node) {
				const source = node.parent.source.value;
				const variable = context.sourceCode.getDeclaredVariables(node)[0];
				const imported = node.imported.name ?? node.imported.value;
				if (source === 'effect' && imported === 'Effect') aliases.add(variable);
				const typeOnly = node.importKind === 'type' || node.parent.importKind === 'type';
				if (source === 'effect/Effect' && defects.has(imported) && !typeOnly)
					importedDefectFunctions.add(variable);
			},
			Identifier(node) {
				const variable = variableOf(node);
				if (!importedDefectFunctions.has(variable)) return;
				const inType = context.sourceCode
					.getAncestors(node)
					.some((ancestor) => ancestor.type === 'TSTypeQuery');
				if (inType) return;
				if (
					variable.references.some(
						(reference) => reference.identifier === node && reference.isRead()
					)
				)
					checkDefect(node);
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
				if (namespace(node.object) && defects.has(propertyName(node))) checkDefect(node);
			}
		};
	}
};
