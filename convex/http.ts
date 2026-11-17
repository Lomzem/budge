import { httpRouter } from 'convex/server';

import { accountsRoute, budgetRoute, transactionsRoute } from './agent';
import { webhook } from './bankConnections';

const http = httpRouter();

http.route({ path: '/plaid/webhook', method: 'POST', handler: webhook });
http.route({ path: '/agent/accounts', method: 'GET', handler: accountsRoute });
http.route({ path: '/agent/budget', method: 'GET', handler: budgetRoute });
http.route({ path: '/agent/transactions', method: 'GET', handler: transactionsRoute });

export default http;
