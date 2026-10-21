---
tags: [fires, smoke, audit-security]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: Reports both the missing ownership filter and the string-built query, with who can reach each.
---

Is this safe to ship? It's a new route going out today.

```ts
router.get('/api/invoices/:id', requireLogin, async (req, res) => {
  const invoice = await db.invoice.findUnique({ where: { id: Number(req.params.id) } });
  if (!invoice) return res.status(404).json({ error: 'not found' });

  const lines = await db.$queryRawUnsafe(
    `SELECT * FROM invoice_lines WHERE invoice_id = ${req.params.id} ORDER BY ${req.query.sort}`,
  );

  logger.info('invoice fetched', { user: req.user, invoice });
  res.json({ invoice, lines });
});
```
