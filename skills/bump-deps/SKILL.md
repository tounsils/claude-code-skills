---
name: bump-deps
description: Upgrade dependencies in risk-ordered batches with a rollback point per batch, reading changelogs for breaking changes before editing and never mixing a major bump with a refactor. Use when asked to update dependencies, bump packages, upgrade a library, fix a vulnerable dependency, deal with Dependabot PRs, or get this project onto current versions.
---

# Upgrade dependencies in batches

A single commit that moves forty packages cannot be reviewed, and when something breaks a week later it cannot be bisected. The whole method is batching by risk with a commit between batches.

## Survey first

Do not upgrade anything yet. Produce the picture.

```bash
npm outdated                              # or: pnpm outdated, yarn outdated
npm audit --omit=dev
pip list --outdated
uv pip list --outdated
go list -m -u all
cargo outdated
```

Then split what comes back into four groups and report them before touching the manifest:

1. **Security**: anything with an advisory that is actually reachable from this project's code. These go first regardless of version distance.
2. **Patch**: bug fixes within the same minor. Low risk, batch them together.
3. **Minor**: new features, same public API by convention. Low to medium risk, batch by package family.
4. **Major**: breaking by declaration. One at a time, never batched.

Note the version distance too. A package three majors behind is a project, not a bump, and saying so up front is more useful than discovering it mid-upgrade.

## Establish the baseline

Everything here depends on knowing the state before you start.

```bash
git status --short                 # must be clean
npm test                           # record passed / failed / skipped
npm run build
npm run lint
```

Record the counts. If the suite is already red or already carries skips, say so now: otherwise you will spend an hour attributing a pre-existing failure to a bump. If the suite is red, stop and offer to fix it first, because a red baseline makes every upgrade unverifiable.

If there is no suite covering the library you are about to upgrade, the upgrade is unverified by definition. Say that in the report rather than implying the green build proved something.

## Work the batches

One batch, one commit, tests between every one. The commit is the rollback point, and it is the only thing that makes a failure a week later tractable.

```bash
# batch 1: security
npm install <pkg>@<fixed-version>
npm test && npm run build
git commit -am "Upgrade <pkg> to <version> for CVE-xxxx-xxxxx"

# batch 2: patch versions together
npm update --save
npm test && npm run build
git commit -am "Update patch versions"

# batch 3 onward: minors, grouped by family
```

Never run a blanket "upgrade everything to latest" command. It produces exactly the unreviewable, unbisectable commit this method exists to avoid.

After each batch, check the lockfile diff, not just the manifest. A one-line manifest change frequently moves dozens of transitive packages, and that is where a surprise arrives.

```bash
git diff --stat package-lock.json
git diff package-lock.json | rg '^\+.*"resolved"' | wc -l
```

## Majors, one at a time

Read before editing. For each major:

1. Find the changelog or migration guide. The releases page, `CHANGELOG.md`, or the `BREAKING CHANGE` entries in the git log.
2. List the breaking changes that apply to this codebase, with the call sites. Grep for each removed or renamed API.
3. Check whether the package ships a codemod. Many do, and it is more reliable than hand editing.
4. Report that list before making changes. A major bump with four breaking changes and eleven affected call sites is a decision, not a chore.

**Never mix a major bump with a refactor.** Two commits: one that adapts to the new API and nothing else, one for any cleanup the new API makes possible. A single commit doing both cannot be reverted when the upgrade turns out to be the problem.

Check the peer dependency graph before starting a major. Upgrading a framework often forces its ecosystem packages too, and that chain is the actual scope of the work.

## Verify at the seam

The test suite is necessary and not sufficient. Dependency upgrades break at the boundary the tests mock out, which is precisely where the dependency lives.

After each batch:

- Run the suite. Report pass, fail, and skip counts every time.
- Run the build, including a production build. A dev build can pass while the bundler, minifier, or tree-shaker fails on the new version.
- Run the application once, for real, and exercise the thing the upgraded package does. A mocked HTTP client proves nothing about a new HTTP client.
- Check for new warnings. Deprecation notices in this major are removals in the next, and they are cheapest to act on now.
- Re-run `npm audit` and confirm the advisory you targeted is gone rather than assuming.

## Flag what should not be bumped

Some packages need a decision, not an upgrade. Raise these instead of silently moving the version:

- **Unmaintained**: last publish years ago, open security issues, a single maintainer, or an archived repository. The fix is replacement or vendoring, and that is the user's call.
- **A dependency with one small use**: a package pulled in for one function. Worth noting as removable.
- **A new or renamed maintainer** on a package that then published a release with install scripts. Worth looking at before installing.
- **A version pinned on purpose.** Check the git history and the comments before unpinning. A pin with no recorded reason is still probably a pin with a reason.
- **An unpinned CI action or base image.** A mutable tag is a dependency that upgrades itself without a commit. Pin it to a sha.

## Report

- **Survey**: the four groups, with counts and version distances.
- **Baseline**: test counts including skips, build, lint.
- **Each batch**: what moved, the commit, and the test result after it.
- **Majors**: the breaking changes that applied, the call sites changed, the migration guide used.
- **Lockfile churn**: how many transitive packages moved.
- **Verification**: suite counts, production build, and the real run you did.
- **Not done**: what you deliberately left behind, and why. A package three majors behind, an advisory with no fixed version available, a pin you did not touch.
