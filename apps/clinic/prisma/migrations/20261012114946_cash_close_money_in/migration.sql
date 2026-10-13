-- Money in is positive on a close item, money out negative. The first rule only knew
-- patient payments as money in, so a close holding a voided cash lab payment (or now a
-- voided expense) was refused. Same list as isMoneyIn() in src/features/billing/cash.ts.
ALTER TABLE "cash_close_item" DROP CONSTRAINT "cash_close_item_sign";
ALTER TABLE "cash_close_item"
  ADD CONSTRAINT "cash_close_item_sign" CHECK (
    ("kind" IN ('payment', 'lab_payment_void', 'expense_void') AND "amount" > 0)
    OR ("kind" NOT IN ('payment', 'lab_payment_void', 'expense_void') AND "amount" < 0)
  );
