---
tags: [fires, smoke, review-diff]
allowed_tools: [Read, Glob, Grep, Skill]
max_turns: 12
expected_outcome: The removed null guard is reported as the top finding.
---

Can you look over this before I commit it? It's the only change on the branch.

```diff
--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@ -12,19 +12,15 @@ import { formatMoney } from '../format';

 export function buildInvoiceLine(item: LineItem, rate: TaxRate): InvoiceLine {
-  if (!item.product) {
-    throw new InvalidLineError(`line ${item.id} has no product`);
-  }
-
-  const unit = item.product.unitPrice;
-  const subtotal = unit * item.quantity;
+  const subtotal = item.product.unitPrice * item.quantity;
   const tax = subtotal * rate.percent;

   return {
     id: item.id,
-    label: item.product.name,
+    label: item.product.name.trim(),
     subtotal,
     tax,
     total: subtotal + tax,
     display: formatMoney(subtotal + tax),
   };
 }
```
