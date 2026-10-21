---
tags: [fires, smoke, ship-pr]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: The pull request body names the auth gate for the new admin endpoint, or flags that it has none.
---

I'm done with this branch. Write me the commit message and the pull request description.

The change does three things:

1. Renames `getUser` to `fetchUser` and updates its four call sites.
2. Adds a new endpoint, `GET /admin/users/:id/export`, which returns a CSV of one user's account history. It's registered in `routes/admin.ts` with `router.get('/users/:id/export', exportUserHistory)`.
3. Adds a database migration that drops the now-unused `users.legacy_ref` column.
