-- CreateEnum
CREATE TYPE "ExpenseMethod" AS ENUM ('cash', 'wallet', 'bank');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CashMovement" ADD VALUE 'expense';
ALTER TYPE "CashMovement" ADD VALUE 'expense_void';

-- CreateTable
CREATE TABLE "expense" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "method" "ExpenseMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'IQD',
    "paid_on" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "payee" TEXT,
    "reference" TEXT,
    "idempotency_key" UUID NOT NULL,
    "journal_entry_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_number_key" ON "expense"("number");

-- CreateIndex
CREATE UNIQUE INDEX "expense_idempotency_key_key" ON "expense"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "expense_journal_entry_id_key" ON "expense"("journal_entry_id");

-- CreateIndex
CREATE INDEX "expense_paid_on_idx" ON "expense"("paid_on");

-- CreateIndex
CREATE INDEX "expense_account_id_paid_on_idx" ON "expense"("account_id", "paid_on");

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Hand-written: numbers, the expense accounts, and guards ───────────────────

CREATE SEQUENCE IF NOT EXISTS "expense_number_seq" START 1;

-- Expense categories are expense accounts (src/features/ledger/accounts.ts). Supplies (5300),
-- salaries (5100) and other (5900) exist already.
INSERT INTO "ledger_account" ("id", "code", "name", "type", "system") VALUES
  (gen_random_uuid(), '5400', 'الإيجار', 'expense', true),
  (gen_random_uuid(), '5500', 'الكهرباء والمولدة والماء', 'expense', true),
  (gen_random_uuid(), '5600', 'الصيانة والتصليح', 'expense', true),
  (gen_random_uuid(), '5700', 'الهاتف والإنترنت', 'expense', true),
  (gen_random_uuid(), '5750', 'الإعلان والتسويق', 'expense', true);

ALTER TABLE "expense"
  ADD CONSTRAINT "expense_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "expense_void_recorded" CHECK (("voided_at" IS NULL) = ("void_reason" IS NULL));

-- An expense is booked to an expense account only.
CREATE FUNCTION expense_account_is_expense() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT "type" FROM "ledger_account" WHERE "id" = NEW."account_id") IS DISTINCT FROM 'expense' THEN
    RAISE EXCEPTION 'an expense must be booked to an expense account' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "expense_account_is_expense" BEFORE INSERT ON "expense"
  FOR EACH ROW EXECUTE FUNCTION expense_account_is_expense();

-- An expense never changes; the only update allowed is voiding it once.
CREATE FUNCTION expense_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable text[] := ARRAY['voided_at', 'voided_by_id', 'void_reason', 'created_by_id'];
BEGIN
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'expenses can''t be edited; void the expense instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."voided_at" IS NOT NULL AND (
    NEW."voided_at" IS DISTINCT FROM OLD."voided_at" OR NEW."void_reason" IS DISTINCT FROM OLD."void_reason"
  ) THEN
    RAISE EXCEPTION 'a void expense can''t be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "expense_guard_update" BEFORE UPDATE ON "expense"
  FOR EACH ROW EXECUTE FUNCTION expense_guard_update();

CREATE TRIGGER "expense_no_delete" BEFORE DELETE ON "expense"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links();
