---
name: restructure
description: Clean up code structure without changing behavior: split god objects by seam, remove dead code, break circular imports, collapse nested conditionals, and give duplicated settings a single owner. Use when asked to clean up the code structure, refactor this, split this file, reduce complexity, pay down tech debt, make this testable, or when a file has grown too large to work in.
---

# Restructure without changing behavior

A restructure that changes behavior is a rewrite with no tests to catch it. Keep the two apart: structure now, behavior in a separate change.

## The rule that makes this safe

One move per commit. Tests green before and after every move.

If the suite is red when you start, stop and say so. Restructuring on a red suite means you cannot tell your breakage from the breakage that was already there. Offer to fix the suite first.

If there is no suite covering what you are about to move, write a characterization test first: call the code, record what it currently returns, assert that. It does not need to assert correct behavior, only current behavior. That test is what makes the move reversible.

## Extract by seam, not by line count

The wrong question is "which 200 lines do I move out of this 900-line file". The right question is "where does this code stop being about the domain and start being about the framework".

A seam is a boundary where the logic no longer needs its surroundings: no request object, no ORM session, no widget, no clock, no filesystem. Code on the pure side of a seam can move out and be tested directly. Code that needs its surroundings stays.

To find the seam, read the class or module and mark every line that touches the outside world: IO, network, database, UI, time, randomness, environment. What is left unmarked is one or more cohesive units. Those are the extractions. Splitting a file down the middle by line count produces two files that both still need everything.

See [references/seams.md](references/seams.md) for the extraction recipes, each with the before and after shape.

## Find the real problem

Run the detection pass before proposing anything. [references/smells.md](references/smells.md) has the full catalog with detection commands and the fix for each. The ones that account for most real pain:

- **God object**: one class or module owning unrelated concerns. Count the reasons it would have to change, not its lines.
- **Feature envy**: a function that reads mostly another object's fields. Move the function to the data.
- **Shotgun surgery**: one conceptual change requires edits in many files. The concept has no home. Give it one.
- **Nested conditionals**: three or more levels hiding a single predicate. Name the predicate and invert to early returns.
- **Long parameter lists**: more than four parameters means one is missing. Pass a typed object.
- **Compared string literals**: a closed set of values compared as strings. Make it an enum or union type so the compiler finds the missing case.
- **One setting with several owners**: the same default duplicated across a config class, a client, a UI default, and an environment file. Pick one owner and document precedence at the point where the values merge.
- **Dead code**: an export nobody imports, a flag always true, a branch unreachable since a type narrowed. Delete it. Do not comment it out; the history holds it.
- **Circular imports**: two modules importing each other. Extract what they share into a third module, or invert the dependency behind an interface.

## Work in this order

1. **Measure.** Report file sizes, the detections you found, and the test coverage over the area. Three numbers, not prose.
2. **Propose.** List the moves in dependency order, smallest first. Say which are mechanical and which need judgment. Get agreement before touching more than a handful of files.
3. **Move, one at a time.** Each move: make it, run the tests, commit. A failure then has a blast radius of one move.
4. **Delete the bridge.** Re-exports and shims added to avoid touching callers are the point of the restructure, not a deliverable. Update the callers and remove the shim in the same change, or the old structure survives next to the new one.
5. **Verify at the seam.** The suite plus one real run of the thing you changed. A suite that passes against a module nobody loads at runtime proves nothing.

## Do not

- Rename and move in the same commit. The diff becomes unreadable and the reviewer cannot tell a rename from a rewrite.
- Introduce an abstraction for one caller. Wait for the second.
- Reformat untouched lines. A whitespace change across a file hides the eight lines that matter.
- Fix a bug you find mid-move. Note it, finish the move, fix it in its own commit with its own test.
- Add a dependency. A restructure that needs a library is a redesign.

## Report

- What you moved and the seam each move followed.
- Test state before and after, with pass, fail, and skip counts. A skipped test is a failing test nobody can see, so report the skip count every time.
- Behavior you could not prove unchanged, and why.
- Bugs found and left alone, with locations.
