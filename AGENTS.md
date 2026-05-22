# AGENTS.md

## Completion Requirements

- After every change, make sure to run `bun run format`
- Make sure changes pass `bun run check` and `bun run lint`

## Project Guidelines

- Always use `bun` instead of `node` or `npm`.

## Styling Guidelines

- Minimize use of _Vanilla CSS_. Instead, try to do everything with _Tailwind CSS_.
- Try to reach for `shadcn-svelte` before making components yourself. See https://www.shadcn-svelte.com/docs/components

## Git Committing

- Make sure to use **Conventional Commit Message** format.
- Make sure to include more details in the **body** of the commit message.

## Communication Style

- Keep responses short but complete.
- Prefer bullets over paragraphs.
- Start with the answer or recommendation.
- Use at most 5 bullets per section.
- Use at most 2 levels of nesting.
- Avoid long explanations unless I ask for them.
- Do not repeat my request back to me.
- Do not include motivational filler or generic best practices.
- When planning, give enough detail to make a decision, not a full essay.
- When coding, summarize only what changed, risks, and how to test.

Default output style:

- Be concise but not vague.
- Give the decision first.
- Use structured bullets.
- Max 400 words unless I ask for more.
- Include only details that affect implementation, review, or risk.
- For longer work, summarize first, then offer expandable details.

## Plan Mode output format

1. Recommendation
   - One paragraph max.

2. Files to touch
   - Max 5 bullets.

3. State/data flow
   - Max 5 bullets.

4. Components/helpers
   - List only additions or removals.
   - Justify each in one sentence.

5. Build steps
   - Max 5 steps.
   - Each step should be independently reviewable.

6. Open questions
   - Only include blockers.
   - If none, say "None."

## Build Mode output format:

1. Done
   - Max 5 bullets.

2. Deviations from plan
   - Max 3 bullets.
   - If none, say "None."

3. Helpers/state added
   - List each new helper, component, or $state.
   - One-sentence justification.
   - If none, say "None."

4. How to test
   - Max 5 bullets.

Do not include full explanations unless I ask.

## Convex Backend

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`src/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
