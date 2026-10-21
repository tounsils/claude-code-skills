# Detection catalog

For each smell: how to detect it, the threshold worth acting on, and the fix. Commands assume ripgrep (`rg`) and a POSIX shell; adapt as needed.

- [God object](#god-object)
- [Dead code](#dead-code)
- [Duplicated logic](#duplicated-logic)
- [Swallowed exceptions](#swallowed-exceptions)
- [Magic numbers](#magic-numbers)
- [Feature envy](#feature-envy)
- [Shotgun surgery](#shotgun-surgery)
- [Primitive obsession and compared strings](#primitive-obsession-and-compared-strings)
- [Build artifacts in version control](#build-artifacts-in-version-control)
- [Comments that narrate history](#comments-that-narrate-history)

## God object

**Detect**: largest files by line count, then count the distinct reasons each would change.

```bash
git ls-files | grep -E '\.(ts|tsx|js|py|go|rb|java)$' | xargs wc -l | sort -rn | head -20
```

**Threshold**: line count alone is not the signal. A 1200-line file of pure data or exhaustive switch cases is fine. Act when one unit owns concerns that change for unrelated reasons: HTTP handling and pricing rules and email templates in one class.

**Fix**: extract by seam. See [seams.md](seams.md).

**Not a fix**: splitting into `thing-part1` and `thing-part2`. The concerns are still entangled, now across two files.

## Dead code

**Detect**: for each export, count its imports elsewhere.

```bash
rg -o 'export (?:const|function|class|type|interface) (\w+)' -r '$1' --no-filename | sort -u |
  while read -r sym; do printf '%s %s\n' "$(rg -c "\b$sym\b" --glob '!*.test.*' | wc -l)" "$sym"; done |
  sort -n | head -40
```

A symbol appearing in exactly one file is defined and never imported. Also look for: a feature flag that is always true, a branch unreachable since a type narrowed, a config key nothing reads, a dependency nothing imports.

**Fix**: delete it. Do not comment it out and do not leave a `// kept for reference` note. Version control is the reference.

**Caveat**: check for dynamic use before deleting. A symbol referenced by string name, through a plugin registry, by reflection, or from a template will not appear in a grep for imports.

## Duplicated logic

**Detect**: the same decision expressed in more than one place. Search for a distinctive constant or an unusual condition from one copy and see how many sites come back.

**Threshold**: three copies, or two copies where one has already drifted from the other. Two identical copies of four obvious lines can stay; the extraction costs more than it saves.

**Fix**: extract the rule, not the text. If two copies look alike but encode different policies that happen to agree today, leave them apart and comment why. Merging two policies because they currently match is how an unrelated change in one feature silently alters another.

## Swallowed exceptions

**Detect**:

```bash
rg -n -A2 'except\s+\w*(Exception|BaseException)?\s*:\s*$' --glob '*.py' | rg -B1 '\bpass\b'
rg -n 'catch\s*\([^)]*\)\s*\{\s*\}' --glob '*.{ts,tsx,js,jsx}'
```

**Threshold**: every occurrence. A silently swallowed error turns a bug report into an unreproducible mystery.

**Fix**: log with the exception and enough context to find the record, then either re-raise or return a typed failure.

**The one legitimate case**: a UI callback boundary where an optional side effect must not break the user's action. Catch narrowly, log, and say in a comment why the failure is not fatal. Still log.

## Magic numbers

**Detect**: numeric literals outside constant declarations, tests, and obvious arithmetic.

```bash
rg -n '\b(?:[3-9]\d{2,}|\d{4,})\b' --glob '!*test*' --glob '!*.json' --glob '!*.lock'
```

**Threshold**: act when the value is load-bearing, meaning a different value changes behavior rather than performance. A retry count, a timeout, a batch size, a threshold, a buffer length.

**Fix**: name it, and record in the comment **how the value was derived**, not what it is.

```ts
// 512: p99 payload is 380 KB; measured by scripts/measure-payloads.ts over
// one week of production logs, with headroom for the largest observed outlier.
const MAX_PAYLOAD_KB = 512;
```

A named constant with no derivation is a magic number with a better name. If you cannot justify the value, you have not found the cause of whatever made you pick it.

## Feature envy

**Detect**: a function whose body reads mostly the fields of one object it was passed, especially when that object's own module has no such function.

**Fix**: move the function onto the type that owns the data, or into that type's module. The call site shortens and the data stops leaking its shape.

## Shotgun surgery

**Detect**: look at recent commits that implemented one feature and count the files each touched.

```bash
git log --format='%h %s' -n 40 --name-only | awk 'NF==0 {print ""} {print}'
```

**Threshold**: a single conceptual change that repeatedly touches many unrelated files. Adding one enum value that requires edits in eleven places is the clearest form.

**Fix**: the concept has no home. Give it one: a module, a registry, or a single table that the eleven places read from. Replace the switch statements with lookups into it.

## Primitive obsession and compared strings

**Detect**:

```bash
rg -n "===?\s*['\"][a-z_]+['\"]" --glob '*.{ts,tsx,js,jsx}'
```

**Threshold**: a closed set of values compared as string literals. Status, role, kind, type, state.

**Fix**: a union type, enum, or constant object. The compiler then finds every site that forgot the new case, which is the entire point. The same applies to a bare `string` holding an id, an email, or a currency amount: a branded type stops a user id being passed where a team id was expected.

## Build artifacts in version control

**Detect**:

```bash
git ls-files | rg -n '(^|/)(dist|build|out|coverage|node_modules|__pycache__|\.next)/|\.(log|pyc|map)$'
```

**Threshold**: every occurrence, with one exception: a committed build output that is the published deliverable, which should say so in the README.

**Fix**: remove from the index with `git rm --cached`, add to `.gitignore`, and commit both together. Note that the files stay in history; removing them from history is a separate decision with a rewrite cost.

## Comments that narrate history

**Detect**:

```bash
rg -n '//\s*(TODO|FIXME|HACK|XXX|NOTE:|Changed|Updated|Added|Removed|Was:|Previously)' 
```

**Threshold**: comments recording what changed, who changed it, or when. Git holds that.

**Fix**: delete the narration. Keep comments that explain **why the code exists** or why an obvious alternative was rejected. For `TODO` and `FIXME`, either file the issue and link it or delete the comment; an unlinked TODO from three years ago is noise that trains readers to ignore all comments.
