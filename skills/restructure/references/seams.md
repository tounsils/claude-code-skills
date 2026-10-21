# Extraction recipes

Each recipe names the seam, the move, and the shape before and after. Apply one at a time.

- [Pure core, thin shell](#pure-core-thin-shell)
- [Inject the clock](#inject-the-clock)
- [Split the query from the decision](#split-the-query-from-the-decision)
- [Replace the flag parameter with two functions](#replace-the-flag-parameter-with-two-functions)
- [Parameter object](#parameter-object)
- [Invert a circular import](#invert-a-circular-import)
- [Collapse nested conditionals](#collapse-nested-conditionals)
- [Give a duplicated default one owner](#give-a-duplicated-default-one-owner)

## Pure core, thin shell

**Seam**: the line where domain rules stop and transport or storage begins.

The handler validates, decides, and persists in one body, so testing the decision requires a request object and a database.

```ts
// before
export async function handler(req: Request, res: Response) {
  const items = await db.cart.findMany({ where: { userId: req.user.id } });
  let total = 0;
  for (const item of items) {
    total += item.price * item.qty;
  }
  if (items.length >= 3) total *= 0.9;
  if (total > 500) total -= 25;
  await db.order.create({ data: { userId: req.user.id, total } });
  res.json({ total });
}
```

```ts
// after: the rule is a function of its inputs
export function priceCart(items: CartItem[]): number {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const afterBulk = items.length >= 3 ? subtotal * 0.9 : subtotal;
  return afterBulk > 500 ? afterBulk - 25 : afterBulk;
}

export async function handler(req: Request, res: Response) {
  const items = await db.cart.findMany({ where: { userId: req.user.id } });
  const total = priceCart(items);
  await db.order.create({ data: { userId: req.user.id, total } });
  res.json({ total });
}
```

`priceCart` now takes a test per rule and per boundary with no fixtures. The handler keeps one test that proves the wiring.

## Inject the clock

**Seam**: any direct read of the current time, a random value, a UUID, or an environment variable.

Code that calls `Date.now()` internally can only be tested at the time the test runs, which is why those tests fail in a different timezone or on the last day of a month.

```ts
// before
function isExpired(token: Token) {
  return token.expiresAt < Date.now();
}
```

```ts
// after
function isExpired(token: Token, now: number) {
  return token.expiresAt < now;
}
```

Pass `Date.now()` at the one call site that owns the boundary. The same move applies to `Math.random()`, `uuid()`, and `process.env`: read them at the edge, pass the value in.

## Split the query from the decision

**Seam**: a function that both asks and acts. It cannot be tested without the thing it asks.

```python
# before
def should_retry(self, job_id):
    job = self.db.get_job(job_id)
    if job.attempts >= self.max_attempts:
        return False
    return job.last_error in RETRYABLE_ERRORS
```

```python
# after
def should_retry(attempts: int, last_error: str, max_attempts: int) -> bool:
    if attempts >= max_attempts:
        return False
    return last_error in RETRYABLE_ERRORS
```

The caller fetches the job. The predicate becomes a table-driven test over the error set and the attempt boundary.

## Replace the flag parameter with two functions

**Seam**: a boolean parameter that selects between two behaviors. The function is two functions sharing a name.

```ts
// before
function render(data: Data, isPreview: boolean) { /* two paths throughout */ }
```

```ts
// after
function renderPreview(data: Data) { /* ... */ }
function renderFinal(data: Data) { /* ... */ }
```

Shared steps move to a private helper both call. Callers become readable at the call site, where `render(data, true)` told the reader nothing.

## Parameter object

**Seam**: more than four parameters, or two adjacent parameters of the same type that can be swapped silently.

```ts
// before
createUser(email, name, role, teamId, isActive, sendEmail, locale);
```

```ts
// after
type CreateUserInput = {
  email: string;
  name: string;
  role: Role;
  teamId: string;
  isActive: boolean;
  sendEmail: boolean;
  locale: string;
};

createUser(input: CreateUserInput);
```

Two same-typed positional parameters are a defect waiting for a hurried edit. Named fields cannot be transposed.

## Invert a circular import

**Seam**: two modules that import each other. The cycle means the shared concept has no module of its own.

```
# before
order.ts    imports  invoice.ts
invoice.ts  imports  order.ts
```

Two fixes, in order of preference:

1. **Extract the shared third thing.** Move the types and pure functions both need into `billing-types.ts`. Both import it, neither imports the other. Prefer this when the cycle is about shared data.
2. **Invert with an interface.** The lower-level module declares the interface it needs; the higher-level module implements it and passes it in. Prefer this when the cycle is about behavior and one direction is genuinely a policy decision.

Do not fix a cycle by moving an import inside a function body. That hides the cycle from the tooling and keeps it at runtime.

## Collapse nested conditionals

**Seam**: three or more levels of nesting. The real predicate is the conjunction of the conditions, and nobody can read it.

```ts
// before
function canPublish(user, post) {
  if (user) {
    if (user.isActive) {
      if (post.status === 'draft') {
        if (post.authorId === user.id || user.role === 'editor') {
          return true;
        }
      }
    }
  }
  return false;
}
```

```ts
// after: guards first, predicate named
function canPublish(user: User | null, post: Post): boolean {
  if (!user?.isActive) return false;
  if (post.status !== 'draft') return false;

  const isOwnPost = post.authorId === user.id;
  return isOwnPost || user.role === 'editor';
}
```

Each early return is one reason to refuse, testable on its own. The name `isOwnPost` is the part a reader was reconstructing in their head.

## Give a duplicated default one owner

**Seam**: the same default value appearing in more than one place. The bug is not the duplication, it is that nobody knows which copy wins.

```ts
// before: four owners of one timeout
class Config { timeout = 30_000; }
class ApiClient { constructor(timeout = 5_000) {} }
// settings dialog defaults the field to 10
// deployment config sets a fifth value
```

```ts
// after: one owner, precedence documented where the values merge
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Timeout precedence, highest first: explicit argument, deployment config,
 * stored user setting, DEFAULT_TIMEOUT_MS.
 */
export function resolveTimeout(explicit?: number): number {
  return explicit ?? deployConfig.timeoutMs ?? userSettings.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}
```

Every consumer calls `resolveTimeout`. The comment lives at the merge point, which is the only place the ordering is a fact rather than a guess.
