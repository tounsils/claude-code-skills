---
tags: [fires, smoke, triage-ci]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: Names the failed install as the cause and the 41 test failures as its cascade.
---

Our build went red and the log is 2,000 lines. Here's the end of it. What's actually wrong?

```
...
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm error code ERESOLVE
npm error ERESOLVE could not resolve
npm error While resolving: @testing-library/react@14.2.1
npm error Found: react@19.0.0
npm error Could not resolve dependency: peer react@"^18.0.0"
npm error A complete log of this run can be found in: /npm-cache/_logs/debug.log
Error: Process completed with exit code 1.

 FAIL  src/components/Button.test.tsx
   Cannot find module '@testing-library/react'
 FAIL  src/components/Modal.test.tsx
   Cannot find module '@testing-library/react'
 FAIL  src/hooks/useAuth.test.tsx
   Cannot find module '@testing-library/react'

 ... 38 more suites failed with the same error

Test Suites: 41 failed, 0 passed, 41 total
Tests:       0 total
Error: Process completed with exit code 1
```
