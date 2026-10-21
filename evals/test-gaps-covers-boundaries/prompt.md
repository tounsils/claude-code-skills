---
tags: [fires, test-gaps]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: Tests cover the zero-parts and remainder boundaries, and the response verifies a test can fail.
---

Write tests for this. It's the only untested thing left in the module.

```ts
/** Splits a total into `parts` whole amounts, distributing any remainder. */
export function splitEvenly(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, i) => (i < remainder ? base + 1 : base));
}
```
