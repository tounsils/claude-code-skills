---
type: llm
---

This handler has three real defects: the invoice is looked up by id with no filter on the caller, so any logged-in user can read any invoice; `req.params.id` and `req.query.sort` are interpolated into raw SQL; and the whole `req.user` and `invoice` objects are logged.

PASS requires both of the first two findings:

1. The missing ownership or tenant filter on the invoice lookup. `requireLogin` authenticates but does not authorize, and the response must say that any authenticated user can read another user's invoice by changing the id.
2. The SQL injection through `req.query.sort`, or through `req.params.id`, in the raw query.

PASS also requires that for at least one finding the response says who can exploit it, meaning any authenticated user rather than an anonymous caller.

Credit, but do not require, the whole-object logging as a third finding.

Credit, but do not require, the note that `ORDER BY` cannot be parameterized and needs an allowlist of column names.

FAIL if the response reports only the SQL injection and treats the lookup as safe because `requireLogin` is present.

FAIL if the response says the route is safe to ship.

FAIL if it includes a working exploit payload rather than describing the input.

Ignore severity labels and scoring schemes.
