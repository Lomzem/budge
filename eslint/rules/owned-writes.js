const writes = new Set(['insert', 'patch', 'replace', 'delete']);

const propertyName = (node) => {
	if (!node.computed) return node.property.name;
	return node.property.type === 'Literal' ? node.property.value : undefined;
};

const isDatabase = (node) =>
	(node.type === 'Identifier' && node.name === 'db') ||
	(node.type === 'MemberExpression' && propertyName(node) === 'db');

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
			unnamedTable: 'Name the table as the first argument of a database write.'
		}
	},
	create(context) {
		const tables = new Set(context.options[0].tables);
		return {
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
