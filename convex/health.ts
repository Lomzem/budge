import { APP_NAME } from '../src/lib/domain';
import { internalQuery } from './_generated/server';

export const ping = internalQuery({
	args: {},
	handler: () => APP_NAME
});
