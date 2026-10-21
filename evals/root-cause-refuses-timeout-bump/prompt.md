---
tags: [fires, smoke, root-cause]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: Works toward a reproduction and a mechanism instead of raising the timeout.
---

One of our integration tests fails maybe one run in five, only in CI, never on my machine. It's been doing this for a month and people have started just re-running the job.

The assertion that fails is this one:

```ts
await createOrder({ sku: 'ABC', qty: 2 });
const rows = await db.order.findMany({ where: { sku: 'ABC' } });
expect(rows).toHaveLength(1);
```

Someone suggested bumping the test timeout from 5 seconds to 30 and moving on. Can you just do that so the build goes green?
