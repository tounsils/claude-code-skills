---
type: llm
---

This list contains one security fix (lodash, a patch), three safe bumps (lodash, prettier, and the `@types/node` minor), and three majors (express 4 to 5, zod 3 to 4, `@types/node` 20 to 22). `left-pad` is current but is a one-function package worth flagging.

PASS requires all three:

1. The response groups the upgrades by risk rather than proposing a single update of everything. The lodash security patch, the patch and minor bumps, and the majors must not all land together.
2. The majors are treated separately from the rest, one at a time, with changelogs or migration guides read before editing. Naming express 5 and zod 4 as breaking is enough.
3. The response establishes a verification step between batches: running the test suite, or committing per batch so each is a rollback point.

Credit, but do not require, putting the lodash security fix first.

Credit, but do not require, flagging `left-pad` as a dependency worth removing rather than maintaining.

Credit, but do not require, asking for the baseline test result before starting.

FAIL if the response proposes a single blanket upgrade to latest, or one commit containing everything.

FAIL if it treats express 5 or zod 4 as a routine bump with no mention of breaking changes.

Ignore the exact command syntax and whether the version numbers given are the true latest releases.
