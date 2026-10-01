-- Receipt and refund numbers come from sequences, never count() + 1.
CREATE SEQUENCE IF NOT EXISTS "receipt_number_seq" START 1;
CREATE SEQUENCE IF NOT EXISTS "refund_number_seq" START 1;

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'wallet');

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "patient_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'IQD',
    "received_on" DATE NOT NULL,
    "notes" TEXT,
    "idempotency_key" UUID NOT NULL,
    "journal_entry_id" UUID,
    "received_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "patient_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'IQD',
    "refunded_on" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "journal_entry_id" UUID,
    "refunded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_number_key" ON "payment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotency_key_key" ON "payment"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_journal_entry_id_key" ON "payment"("journal_entry_id");

-- CreateIndex
CREATE INDEX "payment_patient_id_received_on_idx" ON "payment"("patient_id", "received_on");

-- CreateIndex
CREATE INDEX "payment_received_on_idx" ON "payment"("received_on");

-- CreateIndex
CREATE INDEX "payment_allocation_payment_id_idx" ON "payment_allocation"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocation_invoice_id_idx" ON "payment_allocation"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_number_key" ON "refund"("number");

-- CreateIndex
CREATE UNIQUE INDEX "refund_journal_entry_id_key" ON "refund"("journal_entry_id");

-- CreateIndex
CREATE INDEX "refund_patient_id_refunded_on_idx" ON "refund"("patient_id", "refunded_on");

-- CreateIndex
CREATE INDEX "refund_refunded_on_idx" ON "refund"("refunded_on");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_refunded_by_id_fkey" FOREIGN KEY ("refunded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Payment guards ──────────────────────────────────────────────────────────

ALTER TABLE "payment"
  ADD CONSTRAINT "payment_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "payment_void_recorded" CHECK (
    ("voided_at" IS NULL) = ("void_reason" IS NULL)
  );

ALTER TABLE "payment_allocation"
  ADD CONSTRAINT "payment_allocation_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "refund"
  ADD CONSTRAINT "refund_amount_positive" CHECK ("amount" > 0);

-- A received payment never changes; the only update allowed is voiding it once
-- (plus clearing user links if a user is deleted).
CREATE FUNCTION payment_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable text[] := ARRAY['voided_at', 'voided_by_id', 'void_reason', 'received_by_id'];
BEGIN
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'payments can''t be edited; void the payment instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."voided_at" IS NOT NULL AND (
    NEW."voided_at" IS DISTINCT FROM OLD."voided_at" OR NEW."void_reason" IS DISTINCT FROM OLD."void_reason"
  ) THEN
    RAISE EXCEPTION 'a void payment can''t be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "payment_guard_update" BEFORE UPDATE ON "payment"
  FOR EACH ROW EXECUTE FUNCTION payment_guard_update();

CREATE TRIGGER "payment_no_delete" BEFORE DELETE ON "payment"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links();

CREATE TRIGGER "payment_allocation_append_only" BEFORE UPDATE OR DELETE ON "payment_allocation"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links();

CREATE TRIGGER "refund_append_only" BEFORE UPDATE OR DELETE ON "refund"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('refunded_by_id');
