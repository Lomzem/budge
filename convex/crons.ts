import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// The backup for a lost webhook: once a day, in the small hours US time.
crons.cron('sync every Bank Connection', '17 9 * * *', internal.bankConnections.syncAll, {});

export default crons;
