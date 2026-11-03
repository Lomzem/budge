import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.cron(
	'sync every Bank Connection in case a webhook was lost',
	'17 9 * * *',
	internal.bankConnections.syncAll,
	{}
);

export default crons;
