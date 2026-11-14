import { accounts } from './accounts';
import { bankChanges } from './bank-changes';
import { budget } from './budget';
import { categories } from './categories';
import { creditCards } from './credit-cards';
import { exportJourneys } from './export';
import { imports } from './imports';
import { inspector } from './inspector';
import type { Journey } from './journey';
import { watchUnpromptedLayoutShifts } from './layoutShift';
import { payees } from './payees';
import { plaid } from './plaid';
import { reconciliation } from './reconciliation';
import { search } from './search';
import { settings } from './settings';
import { shell } from './shell';
import { splits } from './splits';
import { targets } from './targets';
import { requireJourneyTimeZone } from './timeZone';
import { transactions } from './transactions';
import { transfers } from './transfers';

export type { Journey, JourneyContext } from './journey';
export { journeyTimeZone, useJourneyTimeZone } from './timeZone';

const byFeature: Record<string, Record<string, Journey>> = {
	accounts,
	'bank-changes': bankChanges,
	budget,
	categories,
	'credit-cards': creditCards,
	export: exportJourneys,
	imports,
	inspector,
	payees,
	plaid,
	reconciliation,
	search,
	settings,
	shell,
	splits,
	targets,
	transactions,
	transfers
};

export interface NamedJourney extends Journey {
	name: string;
	feature: string;
}

export const journeys: readonly NamedJourney[] = Object.entries(byFeature).flatMap(
	([feature, journeysOfFeature]) =>
		Object.entries(journeysOfFeature).map(([key, journey]) => ({
			...journey,
			name: `${feature}/${key}`,
			feature,
			run: async (page, context) => {
				await requireJourneyTimeZone(page);
				const layoutShifts = await watchUnpromptedLayoutShifts(page);
				await journey.run(page, context);
				await layoutShifts.assertNone();
			}
		}))
);
