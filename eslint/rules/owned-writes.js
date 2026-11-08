const writes = new Set(['insert', 'patch', 'replace', 'delete']);

const keyName = (node, computed) => {
	if (!computed) return node.type === 'Identifier' ? node.name : undefined;
	return node.type === 'Literal' ? node.value : undefined;
};

const propertyName = (node) => keyName(node.property, node.computed);

const findVariable = (scope, name) => {
	for (let current = scope; current; current = current.upper) {
		const variable = current.set.get(name);
		if (variable) return variable;
	}
	return undefined;
};

export default {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: {
					tables: { type: 'array', items: { type: 'string' }, minItems: 1 }
				},
				required: ['tables'],
				additionalProperties: false
			}
		],
		messages: {
			ownedTable:
				'Write `{{table}}` through an operation in convex/lib/transactions.ts, which keeps search text, Cleared state, and monthly totals correct.',
			unnamedTable: 'Name the table as the first argument of a database write.',
			detachedWrite:
				'Call `{{method}}` on the database itself, so the table it writes stays checked.'
		}
	},
	create(context) {
		const tables = new Set(context.options[0].tables);
		const sourceCode = context.sourceCode;
		const aliases = new Set();

		const isAlias = (node) => {
			const variable = findVariable(sourceCode.getScope(node), node.name);
			return variable !== undefined && aliases.has(variable);
		};

		const isDatabase = (node) =>
			(node.type === 'Identifier' && (node.name === 'db' || isAlias(node))) ||
			(node.type === 'MemberExpression' && propertyName(node) === 'db');

		const remember = (identifier) => {
			const variable = findVariable(sourceCode.getScope(identifier), identifier.name);
			if (variable) aliases.add(variable);
		};

		const checkPattern = (pattern, source) => {
			if (pattern.type === 'Identifier' && isDatabase(source)) {
				remember(pattern);
				return;
			}
			if (pattern.type !== 'ObjectPattern') return;
			for (const property of pattern.properties) {
				if (property.type !== 'Property') continue;
				const key = keyName(property.key, property.computed);
				if (key === 'db' && property.value.type === 'Identifier') remember(property.value);
				if (isDatabase(source) && writes.has(key)) {
					context.report({ node: property, messageId: 'detachedWrite', data: { method: key } });
				}
			}
		};

		return {
			VariableDeclarator(node) {
				if (node.init) checkPattern(node.id, node.init);
			},
			AssignmentExpression(node) {
				if (node.operator === '=') checkPattern(node.left, node.right);
			},
			CallExpression(node) {
				const { callee } = node;
				if (callee.type !== 'MemberExpression') return;
				if (!writes.has(propertyName(callee)) || !isDatabase(callee.object)) return;
				const [table] = node.arguments;
				if (table?.type !== 'Literal' || typeof table.value !== 'string') {
					context.report({ node, messageId: 'unnamedTable' });
				} else if (tables.has(table.value)) {
					context.report({ node, messageId: 'ownedTable', data: { table: table.value } });
				}
			}
		};
	}
};
