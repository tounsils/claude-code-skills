---
tags: [fires, bump-deps]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: Separates the security fix and the major from the patch and minor bumps, with a commit per batch.
---

Here's what `npm outdated` says. Bring us up to date.

```
Package                  Current   Wanted   Latest
express                    4.18.2   4.21.2   5.1.0
lodash                     4.17.20  4.17.21  4.17.21
zod                        3.22.4   3.24.1   4.0.5
prettier                   3.3.0    3.4.2    3.4.2
@types/node                20.11.5  20.17.9  22.10.2
left-pad                   1.3.0    1.3.0    1.3.0
```

`npm audit` flags the lodash version as having a prototype pollution advisory.
