-- Lab money: a case's cost becomes the lab's bill when the work comes back; payments
-- to labs (cash ones go through the daily cash close); adjustments (discounts / extra
-- charges). Human-readable lab payment numbers come from a sequence.
CREATE SEQUENCE IF NOT EXISTS "lab_payment_number_seq" START 1;

-- CreateEnum
CREATE TYPE "LabAdjustmentKind" AS ENUM ('discount', 'charge');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CashMovement" ADD VALUE 'lab_payment';
ALTER TYPE "CashMovement" ADD VALUE 'lab_payment_void';

-- AlterTable
ALTER TABLE "lab_case" ADD COLUMN     "billed_on" DATE,
ADD COLUMN     "journal_entry_id" UUID;

-- CreateTable
CREATE TABLE "lab_payment" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "lab_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'IQD',
    "paid_on" DATE NOT NULL,
    "notes" TEXT,
    "idempotency_key" UUID NOT NULL,
    "journal_entry_id" UUID,
    "paid_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "lab_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_adjustment" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "kind" "LabAdjustmentKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "made_on" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "journal_entry_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_payment_number_key" ON "lab_payment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "lab_payment_idempotency_key_key" ON "lab_payment"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "lab_payment_journal_entry_id_key" ON "lab_payment"("journal_entry_id");

-- CreateIndex
CREATE INDEX "lab_payment_lab_id_paid_on_idx" ON "lab_payment"("lab_id", "paid_on");

-- CreateIndex
CREATE UNIQUE INDEX "lab_adjustment_journal_entry_id_key" ON "lab_adjustment"("journal_entry_id");

-- CreateIndex
CREATE INDEX "lab_adjustment_lab_id_made_on_idx" ON "lab_adjustment"("lab_id", "made_on");

-- CreateIndex
CREATE UNIQUE INDEX "lab_case_journal_entry_id_key" ON "lab_case"("journal_entry_id");

-- CreateIndex
CREATE INDEX "lab_case_lab_id_billed_on_idx" ON "lab_case"("lab_id", "billed_on");

-- AddForeignKey
ALTER TABLE "lab_case" ADD CONSTRAINT "lab_case_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_payment" ADD CONSTRAINT "lab_payment_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_payment" ADD CONSTRAINT "lab_payment_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_payment" ADD CONSTRAINT "lab_payment_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_payment" ADD CONSTRAINT "lab_payment_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_adjustment" ADD CONSTRAINT "lab_adjustment_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_adjustment" ADD CONSTRAINT "lab_adjustment_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_adjustment" ADD CONSTRAINT "lab_adjustment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ─── Lab money guards ────────────────────────────────────────────────────────

ALTER TABLE "lab_case"
  ADD CONSTRAINT "lab_case_billed_recorded" CHECK (("billed_on" IS NULL) = ("journal_entry_id" IS NULL)),
  ADD CONSTRAINT "lab_case_billed_cost" CHECK ("billed_on" IS NULL OR "cost" > 0),
  ADD CONSTRAINT "lab_case_billed_after_sent" CHECK ("billed_on" IS NULL OR "billed_on" >= "sent_on");

-- Once billed, a case keeps its lab, cost and bill (the statement and the ledger depend
-- on them); a correction is a lab adjustment. A billed case is never deleted.
CREATE FUNCTION lab_case_guard_billed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."journal_entry_id" IS NOT NULL THEN
      RAISE EXCEPTION 'a billed lab case can''t be deleted' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."journal_entry_id" IS NOT NULL AND (
    NEW."journal_entry_id" IS DISTINCT FROM OLD."journal_entry_id"
    OR NEW."billed_on" IS DISTINCT FROM OLD."billed_on"
    OR NEW."cost" IS DISTINCT FROM OLD."cost"
    OR NEW."lab_id" IS DISTINCT FROM OLD."lab_id"
  ) THEN
    RAISE EXCEPTION 'a billed lab case keeps its lab and cost; add a lab adjustment instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "lab_case_guard_billed" BEFORE UPDATE OR DELETE ON "lab_case"
  FOR EACH ROW EXECUTE FUNCTION lab_case_guard_billed();

ALTER TABLE "lab_payment"
  ADD CONSTRAINT "lab_payment_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "lab_payment_method" CHECK ("method" IN ('cash', 'wallet')),
  ADD CONSTRAINT "lab_payment_void_recorded" CHECK (("voided_at" IS NULL) = ("void_reason" IS NULL));

-- A lab payment never changes; the only update allowed is voiding it once.
CREATE FUNCTION lab_payment_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable text[] := ARRAY['voided_at', 'voided_by_id', 'void_reason', 'paid_by_id'];
BEGIN
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'lab payments can''t be edited; void the payment instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."voided_at" IS NOT NULL AND (
    NEW."voided_at" IS DISTINCT FROM OLD."voided_at" OR NEW."void_reason" IS DISTINCT FROM OLD."void_reason"
  ) THEN
    RAISE EXCEPTION 'a void lab payment can''t be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "lab_payment_guard_update" BEFORE UPDATE ON "lab_payment"
  FOR EACH ROW EXECUTE FUNCTION lab_payment_guard_update();

CREATE TRIGGER "lab_payment_no_delete" BEFORE DELETE ON "lab_payment"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links();

ALTER TABLE "lab_adjustment"
  ADD CONSTRAINT "lab_adjustment_amount_positive" CHECK ("amount" > 0);

CREATE TRIGGER "lab_adjustment_append_only" BEFORE UPDATE OR DELETE ON "lab_adjustment"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('created_by_id');
