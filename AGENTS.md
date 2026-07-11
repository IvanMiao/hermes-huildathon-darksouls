# Agent guidelines

## Code readability

- Prefer small, explicitly named modules and functions over clever abstractions.
- Keep control flow straightforward; avoid deeply nested conditionals and hidden side effects.
- Use strict TypeScript types at module boundaries and descriptive domain names.
- Add comments only when they explain intent, constraints, or a non-obvious trade-off.
- Keep tests close to the behavior they verify and make failures easy to understand.

## Documentation reference

Before changing product scope, architecture, runtime contracts, or integrations, consult:

- `IMPLEMENTATION_PLAN.md` for delivery order and completion gates.
- `TWEET_TO_GAME_BUILDATHON_PLAN.md` for the product and demo plan.
- `SOULLOOM_AGENCY_AND_INTEGRATION_DECISIONS.md` for agent and integration decisions.

When implementation and documentation disagree, call out the mismatch instead of silently choosing one.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
