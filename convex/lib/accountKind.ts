import { v } from 'convex/values';

export const accountKind = v.union(v.literal('cash'), v.literal('creditCard'));
