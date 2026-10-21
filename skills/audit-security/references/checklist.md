# Security checklist

Organized by OWASP Top 10 category. Each item gives a detection command, what counts as a finding, and the fix. Commands assume ripgrep (`rg`); adapt the globs to the language in front of you.

- [A01 Broken access control](#a01-broken-access-control)
- [A02 Cryptographic failures](#a02-cryptographic-failures)
- [A03 Injection](#a03-injection)
- [A04 Insecure design](#a04-insecure-design)
- [A05 Security misconfiguration](#a05-security-misconfiguration)
- [A06 Vulnerable components](#a06-vulnerable-components)
- [A07 Authentication failures](#a07-authentication-failures)
- [A08 Integrity failures](#a08-integrity-failures)
- [A09 Logging failures](#a09-logging-failures)
- [A10 Server-side request forgery](#a10-server-side-request-forgery)
- [Client-side sinks](#client-side-sinks)
- [File uploads](#file-uploads)

## A01 Broken access control

**Insecure direct object reference.** The highest-yield finding in most codebases.

```bash
rg -n 'findUnique|findById|findOne|get_object_or_404|\.get\(pk=' -B3 -A3
```

A lookup by an id taken from the request path, query, or body, with no filter on the caller's own scope, is a finding. Any authenticated user can read or modify any record by changing a number in a URL.

Fix: filter in the query, not after it. `where: { id, tenantId: caller.tenantId }`. A fetch-then-compare leaves a timing and logic gap and gets dropped in a refactor.

**Missing gate.** Enumerate every route and name the gate for each.

```bash
rg -n '(router|app)\.(get|post|put|patch|delete|use)\(' --glob '!*test*'
rg -n '@(app|router|blueprint)\.(route|get|post|put|patch|delete)' --glob '*.py'
```

A route reachable without authentication that returns or modifies user data is a finding. Check that global middleware is actually applied before the route is registered: a route mounted above the auth middleware runs ungated, which reads as protected in the source.

**Vertical escalation.** A role or permission taken from the request body, a user-editable `isAdmin` field, or a role check that trusts a client-supplied claim without verifying the token signature.

**Mass assignment.** A create or update that spreads the whole request body into a model.

```bash
rg -n 'data:\s*(req\.body|request\.(json|data))|\*\*request\.(json|form)|Object\.assign\([^,]+,\s*req\.body'
```

Fix: an explicit allowlist of writable fields. A denylist misses the field added next month.

## A02 Cryptographic failures

**Weak hashing for passwords.**

```bash
rg -n 'md5|sha1|sha256\(.*password|createHash'
```

A password stored with any plain hash, with or without a salt, is a finding. Fix: argon2id, scrypt, or bcrypt with the library's current default cost.

**Home-rolled cryptography**, ECB mode, a static or zero initialization vector, a key derived from a short string, or `Math.random()` used for a token, session id, password reset code, or nonce.

```bash
rg -n 'createCipher\(|ECB|Math\.random\(\)' --glob '!*test*'
rg -n 'random\.(random|randint|choice)' --glob '*.py' --glob '!*test*'
```

Fix: the platform CSPRNG. `crypto.randomBytes`, `crypto.randomUUID`, `secrets.token_urlsafe`.

**Secrets in source.** See the main skill. Also check CI workflow files, container definitions, committed configuration, and test fixtures.

```bash
rg -n '(?i)(api[_-]?key|secret|passwd|password|token)\s*[=:]\s*["'"'"'][^"'"'"']{8,}' --glob '!*.lock'
rg -n 'BEGIN [A-Z ]*PRIVATE KEY'
```

**Transport.** An `http://` URL for anything carrying credentials or user data, a disabled certificate check (`rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify: true`), or a downgrade path left in for local development that is reachable in production.

## A03 Injection

**SQL.** String building into a query. Look for concatenation, template interpolation, and `%` formatting next to `execute`, `query`, or `raw`.

```bash
rg -n '(execute|query|raw|rawQuery)\s*\(' -A2 | rg '\+|\$\{|%s|%\(|f["'"'"']'
```

Fix: parameterized queries. An ORM is not automatic protection; its raw escape hatch takes the same input.

Identifiers (table and column names) cannot be parameterized. If one comes from input, validate it against an allowlist of known names.

**Command.**

```bash
rg -n 'exec\(|execSync|spawn\(|child_process|os\.system|subprocess\.(run|call|Popen)|shell=True|`[^`]*\$\{' --glob '!*test*'
```

Fix: pass an argument array, never a shell string. `shell=True` and `exec` with interpolation are findings whenever any part of the string comes from input.

**Path traversal.**

```bash
rg -n 'readFile|writeFile|open\(|sendFile|path\.join\(' -A1 | rg 'req\.|request\.|params|query|body'
```

Fix: resolve the path, then confirm the result still starts with the intended base directory. Stripping `..` from the input is not sufficient: encoded forms, symlinks, and absolute paths all bypass it.

**Template and expression injection.** User input reaching a template compiler, an expression evaluator, a regular expression constructor, or a deserializer. A user-supplied pattern passed to `new RegExp` is also a denial-of-service vector through catastrophic backtracking.

## A04 Insecure design

- **No rate limit** on login, registration, password reset, token exchange, or any endpoint that sends email or SMS. Unlimited attempts turn a weak password policy into a breach and an email endpoint into someone else's spam problem.
- **Password reset tokens** that are predictable, long-lived, reusable, or not invalidated after use.
- **Business logic bypass**: a quantity, price, discount, or total taken from the client and trusted. Recompute server-side.
- **Race on a limited resource**: a check-then-act on inventory, balance, or a one-time code, with no transaction or lock. Two concurrent requests both pass the check.

## A05 Security misconfiguration

**CORS.**

```bash
rg -n 'cors|Access-Control-Allow-Origin|allow_origins'
```

Findings: a wildcard origin together with credentials, an origin reflected from the request header, or a regex that matches more than intended (an unescaped dot, or no anchor, so `example.com.attacker.net` matches).

**Cookies.** Every session or auth cookie needs `HttpOnly`, `Secure`, and `SameSite`. Missing `HttpOnly` turns any XSS into session theft.

```bash
rg -n 'setCookie|set_cookie|cookie\(' -A3
```

**Debug surfaces in production**: a debug flag, a verbose error handler, an exposed stack trace, a profiler or admin route with no gate, a GraphQL introspection endpoint, a source map served publicly, or a directory listing.

**Security headers**: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `X-Frame-Options` or a CSP `frame-ancestors`. Absence is a finding on an app serving HTML, not on a pure JSON API.

## A06 Vulnerable components

```bash
npm audit --omit=dev
pip-audit
cargo audit
```

Report what the change introduced, plus anything high severity that is actually reachable from this application's code. Check also for a dependency that is unmaintained: last publish years ago, open security issues, or a single maintainer account. That is a finding worth raising even with no current advisory.

Confirm the lockfile is committed. Without one, a transitive dependency resolves to a different version per install, and a compromised release lands silently.

## A07 Authentication failures

- Session id not rotated on login or on privilege change, enabling session fixation.
- No server-side invalidation on logout, so a stolen token works until expiry.
- A long-lived token with no revocation path.
- A JWT verified with the algorithm taken from its own header, or with verification disabled, or with a weak shared secret. Check that `none` is rejected.
- Credentials compared with `==`, leaking length and content through timing. Use a constant-time comparison.
- User enumeration: different responses, or measurably different timings, for an unknown user and a wrong password.

## A08 Integrity failures

**Deserialization of untrusted data.**

```bash
rg -n 'pickle\.loads|yaml\.load\(|unserialize|Marshal\.load|ObjectInputStream|eval\(|JSON\.parse\(.*req\.'
```

`pickle.loads` and `yaml.load` without `SafeLoader` on untrusted input are remote code execution. Fix: `yaml.safe_load`, JSON, or a schema-validated format.

**Supply chain**: an unpinned dependency, a `postinstall` script in a newly added package, a CI action referenced by a mutable tag rather than a commit sha, or a build that fetches a script over the network and pipes it to a shell.

## A09 Logging failures

**Sensitive data in logs.**

```bash
rg -n '(console\.log|logger?\.\w+|print)\(' -A1 | rg -i 'password|token|secret|req\b|request\b|user\b|body|headers|card'
```

Logging a whole request, user, or payload object is the finding, because it captures whatever fields are added later. Fix: log named fields, or a redacting serializer.

**Missing logs** on the events an incident response needs: authentication success and failure, authorization denial, privilege change, password reset, and data export. Each needs the actor, the target, the source address, and the time.

**Log injection**: unescaped newlines from user input, letting an attacker forge log entries.

## A10 Server-side request forgery

```bash
rg -n '(fetch|axios|requests\.(get|post)|urllib|http\.(get|request)|HttpClient)' -B2 -A2 | rg 'req\.|request\.|params|body|query|url'
```

A URL, hostname, or redirect target taken from input and fetched server-side is a finding. The target is usually the cloud instance metadata endpoint or an internal service with no authentication.

Fix: an allowlist of permitted hosts, resolved and checked after DNS resolution, rejecting private and link-local address ranges. Disable redirect following, or re-validate the destination after each redirect. Blocking by hostname string alone fails to DNS rebinding and to decimal or IPv6-mapped encodings of the same address.

**Open redirect**: a `redirect` or `next` parameter used without validating that the destination is a path within the application.

## Client-side sinks

```bash
rg -n 'innerHTML|outerHTML|dangerouslySetInnerHTML|insertAdjacentHTML|document\.write|v-html|\$\(.*\)\.html\('
```

Any of these receiving data that originated from a user is stored or reflected XSS. Fix: render as text, or sanitize with a maintained library configured to strip event handlers and `javascript:` URLs.

Also check: a `postMessage` handler with no origin check, `localStorage` holding a session token (readable by any script on the page), and a `target="_blank"` link without `rel="noopener"`.

## File uploads

- Content type trusted from the client header rather than checked against the file's actual bytes.
- A filename from the client used in a path, or used unescaped in a `Content-Disposition` header.
- No size limit, which is a disk and memory denial of service.
- Uploads written inside the web root, where an uploaded script can be requested and executed.
- No limit on the decompressed size of an archive, allowing a compression bomb.
