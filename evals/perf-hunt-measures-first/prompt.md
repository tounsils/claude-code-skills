---
tags: [fires, perf-hunt]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: Identifies the query per row and asks for a measurement before optimizing.
---

This endpoint takes about four seconds on our dashboard page. Make it faster.

```ts
export async function listProjects(userId: string) {
  const projects = await db.project.findMany({ where: { ownerId: userId } });

  const result = [];
  for (const project of projects) {
    const owner = await db.user.findUnique({ where: { id: project.ownerId } });
    const taskCount = await db.task.count({ where: { projectId: project.id } });
    result.push({ ...project, ownerName: owner.name, taskCount });
  }
  return result;
}
```
