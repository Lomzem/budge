import { httpRouter } from 'convex/server';

import { webhook } from './bankConnections';

const http = httpRouter();

http.route({ path: '/plaid/webhook', method: 'POST', handler: webhook });

export default http;
