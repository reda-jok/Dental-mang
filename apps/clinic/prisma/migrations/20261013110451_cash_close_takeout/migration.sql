-- CreateEnum
CREATE TYPE "CashTakenTo" AS ENUM ('owner', 'bank');

-- AlterTable
ALTER TABLE "cash_close" ADD COLUMN     "kept" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "opening" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taken_to" "CashTakenTo";

-- ─── Guards ──────────────────────────────────────────────────────────────────

-- The drawer now starts from what the previous close left in it.
ALTER TABLE "cash_close" DROP CONSTRAINT "cash_close_amounts_valid";
ALTER TABLE "cash_close"
  ADD CONSTRAINT "cash_close_amounts_valid" CHECK (
    "counted" >= 0 AND "cash_in" >= 0 AND "cash_out" >= 0 AND "card" >= 0 AND "wallet" >= 0
    AND "opening" >= 0
    AND "expected" = "opening" + "cash_in" - "cash_out"
    AND "difference" = "counted" - "expected"
    AND "kept" >= 0 AND "kept" <= "counted"
  );

-- A destination only when something was taken out. (Closes before this kept nothing and
-- named no destination, so "taken out without a destination" can't be refused here; the
-- service requires one.)
ALTER TABLE "cash_close"
  ADD CONSTRAINT "cash_close_taken_to" CHECK ("taken_to" IS NULL OR "kept" < "counted");

-- ─── Owner's drawings: cash handed to the owner at a close ───────────────────

INSERT INTO "ledger_account" ("id", "code", "name", "type", "system") VALUES
  (gen_random_uuid(), '3100', 'مسحوبات المالك', 'equity', true);
