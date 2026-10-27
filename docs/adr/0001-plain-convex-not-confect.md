# Plain Convex functions, not Confect

Budge uses Effect heavily, but its Convex functions are ordinary `query`, `mutation`, and `action` exports with `v.*` validators; Effect runs inside a handler body, not as the framework around it. Confect 10.x (`@confect/*`) was the alternative: Effect Schema as the single source of shapes, with Convex's database, auth, and scheduler behind Effect services. We passed on it for now because it is a community framework with no Svelte package, its query-clock handling differs between its docs and its source (which bears on Convex query caching), and backing it out later would touch every function, while adopting it later is one migration.

## Consequences

Reconsider Confect after the first deployed Bank Connection slice, if keeping `v.*` validators and Effect Schemas side by side becomes painful. If adopted, use the scoped `@confect/*` packages, never `@rjdellecese/confect` (Effect 3 only) or the unrelated unscoped `confect`.
