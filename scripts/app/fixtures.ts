export interface Fixture {
	name: string;
	summary: string;
	convexFunctionsToRun: string[];
}

export const FIXTURES: readonly Fixture[] = [
	{
		name: 'empty-budget',
		summary: 'No Accounts, Categories or cutover date: what the owner sees on first sign-in.',
		convexFunctionsToRun: []
	},
	{
		name: 'budget-with-accounts',
		summary:
			'Checking, Savings and Card with about three months of invented Transactions (seed:run).',
		convexFunctionsToRun: ['seed:run']
	}
];

export function findFixture(name: string) {
	return FIXTURES.find((fixture) => fixture.name === name);
}
