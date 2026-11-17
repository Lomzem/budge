import { httpRouter } from 'convex/server';

import {
	accountsRoute,
	applyProposalRoute,
	budgetRoute,
	recentProposalsRoute,
	transactionsRoute,
	undoProposalRoute
} from './agent';
import { webhook } from './bankConnections';

const http = httpRouter();

http.route({ path: '/plaid/webhook', method: 'POST', handler: webhook });
http.route({ path: '/agent/accounts', method: 'GET', handler: accountsRoute });
http.route({ path: '/agent/budget', method: 'GET', handler: budgetRoute });
http.route({ path: '/agent/transactions', method: 'GET', handler: transactionsRoute });
http.route({ path: '/agent/proposals', method: 'POST', handler: applyProposalRoute });
http.route({ path: '/agent/proposals', method: 'GET', handler: recentProposalsRoute });
http.route({ path: '/agent/proposals/undo', method: 'POST', handler: undoProposalRoute });

export default http;
