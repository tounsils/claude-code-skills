---
name: audit-security
description: Security review of a change or working tree against the OWASP Top 10: committed secrets, injection, broken access control, SSRF, insecure deserialization, permissive CORS, vulnerable dependencies, and sensitive data in logs. Reports exploitability, not category names. Use when asked to security review this, audit for vulnerabilities, check this is safe to ship, or before pushing code that touches auth, user input, or data access.
---

# Security review

This is a code review with a threat model. It reads code and configuration. It does not run exploits, scanners, or anything against a live system.

## Scope

Default to the change plus what the change can reach:

```bash
git diff $(git merge-base HEAD origin/main)
git diff --stat $(git merge-base HEAD origin/main)
git status --short
```

For a full-repo audit, say so and work through [references/checklist.md](references/checklist.md) area by area, because a whole-codebase pass without a checklist silently becomes a sample.

Reaching beyond the diff matters: a new function that builds a query string is only a vulnerability if something untrusted reaches it. Trace each new input backward to its source and each new sink backward to its callers.

## Always check these

**Committed secrets.** Highest frequency, lowest effort to find, and the one finding with a remediation step people forget.

```bash
git diff $(git merge-base HEAD origin/main) | rg -n '(?i)(api[_-]?key|secret|password|passwd|token|private[_-]key|bearer|authorization:)\s*[=:]'
git log --all --oneline -- '**/.env' '**/.env.*' '**/*.pem' '**/*.p12' '**/id_rsa*'
git ls-files | rg '(^|/)\.env($|\.)' 
```

A secret that reached a remote is compromised even after the commit is removed, because clones and forks keep it. The finding is "rotate this credential", not "delete this line". Say that.

Check that fixtures and examples use values that look synthetic and say they are synthetic. A realistic-looking fake key gets found by a scanner and rotated in a panic.

**Authorization on every new or changed route.** Authentication proves who the caller is. Authorization decides what this caller may touch, and it is the one that gets skipped.

For each endpoint in the diff, answer both:

1. Which gate requires a logged-in caller? Name it. If the answer is a global middleware, confirm this route is actually mounted inside it rather than assuming.
2. Does the query filter by the caller's own scope? A handler that takes an id from the path and looks it up without a tenant or owner filter lets any authenticated user read any record. This is the most common serious finding in real code.

```bash
rg -n '(router|app)\.(get|post|put|patch|delete)\(' --glob '!*test*'
rg -n '@(app|router)\.(get|post|put|patch|delete)\(' --glob '*.py'
```

**Injection.** Untrusted input reaching an interpreter: SQL, shell, path, template, LDAP, or a NoSQL query document.

```bash
rg -n 'execute\(|raw\(|query\(' -A2 | rg -n '\+|\$\{|%s|f["'"'"']'
rg -n 'exec|execSync|spawn|system|popen|eval|Function\(' --glob '!*test*'
```

String concatenation into a query or a command is the finding. Parameterized queries and argument arrays are the fix. For paths, the fix is resolving and then confirming the result is still inside the intended directory, not stripping `..` from the input.

**Sensitive data in logs and errors.** Grep the diff for logging calls that take a whole request, user, or payload object. Whole-object logging is how passwords, tokens, and personal data end up in a log aggregator with much weaker access control than the database. Also check that error responses to the client do not carry stack traces, query text, or internal hostnames.

**Dependencies.**

```bash
npm audit --omit=dev     # or: pnpm audit, yarn npm audit
pip-audit                 # or: uv pip audit
```

Report only what the change introduced or what is both reachable and high severity. A list of 300 transitive advisories is noise that buries the two that matter.

## Then work the checklist

[references/checklist.md](references/checklist.md) covers the rest, organized by OWASP category with detection commands: SSRF, deserialization, CORS and cookie flags, cryptography and password storage, rate limiting on auth endpoints, file upload handling, XSS sinks, redirect validation, mass assignment, and security headers.

Read the whole file for a full audit. For a diff review, read the sections the diff touches.

## Report exploitability

A finding named only by its category is unactionable. For each one give:

- `path/to/file.ts:42` and the category.
- **Who**: an anonymous caller, any authenticated user, a user in another tenant, or someone who already has local access. The difference between the first two is usually the difference between urgent and scheduled.
- **With what**: the concrete input. An actual example string, not "malicious input".
- **To get what**: read another tenant's data, execute a command, escalate to admin, deny service.
- **Fix**: the specific change, with the parameterized or validated form written out.

Then rank by that, not by a scanner's severity field. An SQL injection behind an admin-only route and an IDOR on a public endpoint are not the same risk, whatever the CVSS table says.

Try to refute each finding before reporting it: look for the validation upstream, the ORM that already parameterizes, the middleware that already gates, the type that makes the input unreachable. Say which findings you confirmed by tracing the full path and which remain plausible but unconfirmed.

## Stay inside the lines

- Read code and configuration. Do not run exploits, port scans, or traffic against any host.
- Do not include a working exploit in the report. The input that demonstrates the path is enough.
- Do not print a discovered secret. Give its location and its type, and say to rotate it.
- If a finding needs a live check to confirm, say what check is needed and leave it to someone with authorization to run it.
