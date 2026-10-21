---
tags: [fires, restructure]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: Proposes extracting the pricing rules from the handler, and insists on tests before moving anything.
---

This handler has gotten out of hand and I can't test any of it. Can you clean up the structure?

```ts
export async function checkoutHandler(req: Request, res: Response) {
  const cart = await db.cart.findMany({ where: { userId: req.user.id } });
  let total = 0;
  for (const item of cart) {
    if (item.product) {
      if (item.product.active) {
        if (item.quantity > 0) {
          total += item.product.unitPrice * item.quantity;
        }
      }
    }
  }
  if (cart.length >= 3) {
    total = total * 0.9;
  }
  if (total > 500) {
    total = total - 25;
  }
  if (req.user.tier === 'gold') {
    total = total * 0.95;
  } else if (req.user.tier === 'silver') {
    total = total * 0.98;
  }
  const order = await db.order.create({ data: { userId: req.user.id, total } });
  await mailer.send(req.user.email, 'Order confirmed', `Total: ${total}`);
  logger.info(`order ${order.id} created for ${req.user.id} at ${Date.now()}`);
  res.json({ orderId: order.id, total });
}
```
