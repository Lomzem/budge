import { readFileSync } from 'node:fs';
import path from 'node:path';

const queriesIn = (file) =>
	new Set(
		[...readFileSync(file, 'utf8').matchAll(/useQuery\(\s*(api(?:\.\w+)+)/g)].map((m) => m[1])
	);

const chainOf = (node) => {
	if (node.type === 'Identifier') return node.name;
	if (node.type !== 'MemberExpression' || node.computed) return undefined;
	const object = chainOf(node.object);
	return object && `${object}.${node.property.name}`;
};

const isFunction = (node) =>
	node.type === 'ArrowFunctionExpression' ||
	node.type === 'FunctionExpression' ||
	node.type === 'FunctionDeclaration';

const returnsIn = (node) => {
	if (node?.type === 'ReturnStatement') return [node];
	if (typeof node?.type !== 'string' || isFunction(node)) return [];
	return Object.entries(node)
		.filter(([key]) => key !== 'parent')
		.flatMap(([, value]) => (Array.isArray(value) ? value.flatMap(returnsIn) : returnsIn(value)));
};

const unscoped = (node) => {
	if (!node) return true;
	if (node.type === 'ObjectExpression') return node.properties.length === 0;
	if (node.type === 'Literal') return node.value === 'skip';
	if (node.type === 'ConditionalExpression')
		return unscoped(node.consequent) && unscoped(node.alternate);
	if (isFunction(node)) {
		if (node.body.type !== 'BlockStatement') return unscoped(node.body);
		const returns = node.body.body.flatMap(returnsIn);
		return returns.length > 0 && returns.every((statement) => unscoped(statement.argument));
	}
	return false;
};

const isConvexUseQuery = (sourceCode, callee) => {
	if (callee.type !== 'Identifier') return false;
	let scope = sourceCode.getScope(callee);
	while (scope) {
		const variable = scope.set.get(callee.name);
		if (variable) {
			const definition = variable.defs[0];
			return (
				definition?.type === 'ImportBinding' &&
				definition.node.type === 'ImportSpecifier' &&
				definition.node.imported.name === 'useQuery' &&
				definition.parent.source.value === 'convex-svelte'
			);
		}
		scope = scope.upper;
	}
	return false;
};

export default {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: { owner: { type: 'string' } },
				required: ['owner'],
				additionalProperties: false
			}
		],
		messages: {
			shared:
				'The app layout already subscribes to `{{query}}`. Read it from `getShellQueries()` in {{owner}}, so switching tabs shows it without loading.'
		}
	},
	create(context) {
		const [{ owner }] = context.options;
		const ownerFile = path.resolve(context.cwd, owner);
		if (path.resolve(context.filename) === ownerFile) return {};
		const shared = queriesIn(ownerFile);
		return {
			CallExpression(node) {
				if (!isConvexUseQuery(context.sourceCode, node.callee)) return;
				const query = node.arguments[0] && chainOf(node.arguments[0]);
				if (!query || !shared.has(query) || !unscoped(node.arguments[1])) return;
				context.report({ node, messageId: 'shared', data: { query, owner } });
			}
		};
	}
};
