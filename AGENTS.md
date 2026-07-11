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
