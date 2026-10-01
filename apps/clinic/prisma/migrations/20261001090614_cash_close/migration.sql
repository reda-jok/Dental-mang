-- CreateEnum
CREATE TYPE "CashMovement" AS ENUM ('payment', 'payment_void', 'refund');

-- CreateTable
CREATE TABLE "cash_close" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "closed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected" DECIMAL(14,2) NOT NULL,
    "counted" DECIMAL(14,2) NOT NULL,
    "difference" DECIMAL(14,2) NOT NULL,
    "cash_in" DECIMAL(14,2) NOT NULL,
    "cash_out" DECIMAL(14,2) NOT NULL,
    "card" DECIMAL(14,2) NOT NULL,
    "wallet" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "closed_by_id" UUID,
    "journal_entry_id" UUID,

    CONSTRAINT "cash_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_close_item" (
    "id" UUID NOT NULL,
    "close_id" UUID NOT NULL,
    "kind" "CashMovement" NOT NULL,
    "source_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "cash_close_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_close_day_key" ON "cash_close"("day");

-- CreateIndex
CREATE UNIQUE INDEX "cash_close_journal_entry_id_key" ON "cash_close"("journal_entry_id");

-- CreateIndex
CREATE INDEX "cash_close_item_close_id_idx" ON "cash_close_item"("close_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_close_item_kind_source_id_key" ON "cash_close_item"("kind", "source_id");

-- AddForeignKey
ALTER TABLE "cash_close" ADD CONSTRAINT "cash_close_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_close" ADD CONSTRAINT "cash_close_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_close_item" ADD CONSTRAINT "cash_close_item_close_id_fkey" FOREIGN KEY ("close_id") REFERENCES "cash_close"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Guards ──────────────────────────────────────────────────────────────────

ALTER TABLE "cash_close"
  ADD CONSTRAINT "cash_close_amounts_valid" CHECK (
    "counted" >= 0 AND "cash_in" >= 0 AND "cash_out" >= 0 AND "card" >= 0 AND "wallet" >= 0
    AND "expected" = "cash_in" - "cash_out"
    AND "difference" = "counted" - "expected"
  );

ALTER TABLE "cash_close_item"
  ADD CONSTRAINT "cash_close_item_sign" CHECK (
    ("kind" = 'payment' AND "amount" > 0) OR ("kind" <> 'payment' AND "amount" < 0)
  );

-- A close is a record of what was counted: never edited or deleted.
CREATE TRIGGER "cash_close_append_only" BEFORE UPDATE OR DELETE ON "cash_close"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('closed_by_id');

CREATE TRIGGER "cash_close_item_append_only" BEFORE UPDATE OR DELETE ON "cash_close_item"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links();
