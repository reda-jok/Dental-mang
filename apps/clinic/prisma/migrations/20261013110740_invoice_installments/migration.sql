-- CreateTable
CREATE TABLE "invoice_installment" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "deposit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "invoice_installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_installment_due_date_idx" ON "invoice_installment"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_installment_invoice_id_seq_key" ON "invoice_installment"("invoice_id", "seq");

-- AddForeignKey
ALTER TABLE "invoice_installment" ADD CONSTRAINT "invoice_installment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoices issued before installments existed are due in full on their due date.
INSERT INTO "invoice_installment" ("id", "invoice_id", "seq", "due_date", "amount")
SELECT gen_random_uuid(), "id", 1, "due_date", "total" FROM "invoice" WHERE "total" > 0;

ALTER TABLE "invoice_installment"
  ADD CONSTRAINT "invoice_installment_amount_positive" CHECK ("amount" > 0);

-- An invoice's installments add up to its total (none for a zero total). Checked at commit
-- (deferred), so the invoice and its rows can be inserted one after another.
CREATE FUNCTION invoice_assert_installments(inv uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  invoice_total numeric;
  scheduled numeric;
BEGIN
  SELECT "total" INTO invoice_total FROM "invoice" WHERE "id" = inv;
  SELECT coalesce(sum("amount"), 0) INTO scheduled
    FROM "invoice_installment" WHERE "invoice_id" = inv;
  IF invoice_total IS DISTINCT FROM scheduled THEN
    RAISE EXCEPTION 'installments of invoice % add up to %, not its total %',
      inv, scheduled, invoice_total
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE FUNCTION invoice_installments_invoice_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM invoice_assert_installments(NEW."id");
  RETURN NULL;
END $$;

CREATE FUNCTION invoice_installments_row_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM invoice_assert_installments(NEW."invoice_id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "invoice_installments_add_up" AFTER INSERT OR UPDATE OF "total" ON "invoice"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION invoice_installments_invoice_trigger();

CREATE CONSTRAINT TRIGGER "invoice_installment_adds_up" AFTER INSERT ON "invoice_installment"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION invoice_installments_row_trigger();

-- A schedule never changes: a wrong one is fixed by voiding the invoice and issuing it again.
CREATE FUNCTION invoice_installment_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'invoice installments never change; void the invoice and issue it again'
    USING ERRCODE = 'check_violation';
END $$;

CREATE TRIGGER "invoice_installment_append_only" BEFORE UPDATE OR DELETE ON "invoice_installment"
  FOR EACH ROW EXECUTE FUNCTION invoice_installment_append_only();
