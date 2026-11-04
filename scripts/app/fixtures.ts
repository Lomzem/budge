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
	},
	{
		name: 'bank-sync',
		summary:
			'budget-with-accounts plus two Bank Connections built through the sync mutations, no Plaid: Sample Credit Union with three held bank Accounts, a changed and a removed Bank Row and consent ending in 5 days; Sample Savings Bank needing a reconnect.',
		convexFunctionsToRun: ['seed:run', 'seedBankSync:run']
	}
];

export function findFixture(name: string) {
	return FIXTURES.find((fixture) => fixture.name === name);
}
