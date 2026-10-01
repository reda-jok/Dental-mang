-- Human-readable journal entry numbers (JE-000123); never count() + 1.
CREATE SEQUENCE IF NOT EXISTS "journal_entry_number_seq" START 1;

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- CreateTable
CREATE TABLE "role_permission" (
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role","permission")
);

-- CreateTable
CREATE TABLE "ledger_account" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "ledger_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL DEFAULT ('JE-'::text || lpad((nextval('journal_entry_number_seq'::regclass))::text, 6, '0'::text)),
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'IQD',
    "source_type" TEXT NOT NULL,
    "source_id" UUID,
    "reverses_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_line" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "memo" TEXT,

    CONSTRAINT "journal_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_account_code_key" ON "ledger_account"("code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_number_key" ON "journal_entry"("number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_reverses_id_key" ON "journal_entry"("reverses_id");

-- CreateIndex
CREATE INDEX "journal_entry_date_idx" ON "journal_entry"("date");

-- CreateIndex
CREATE INDEX "journal_entry_source_type_source_id_idx" ON "journal_entry"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "journal_line_entry_id_idx" ON "journal_line"("entry_id");

-- CreateIndex
CREATE INDEX "journal_line_account_id_idx" ON "journal_line"("account_id");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER SEQUENCE "journal_entry_number_seq" OWNED BY "journal_entry"."number";

-- ─── Ledger guards ───────────────────────────────────────────────────────────

-- Each line is either a debit or a credit: positive, never both, never neither.
ALTER TABLE "journal_line"
  ADD CONSTRAINT "journal_line_one_side" CHECK (
    ("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)
  );

ALTER TABLE "journal_entry"
  ADD CONSTRAINT "journal_entry_not_self_reversal" CHECK ("reverses_id" <> "id");

-- Debits = credits for every entry, with at least two lines. Checked at COMMIT
-- (deferred), so the entry and its lines can be inserted one after another.
CREATE FUNCTION journal_assert_balanced(entry uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
  line_count integer;
BEGIN
  SELECT coalesce(sum("debit"), 0), coalesce(sum("credit"), 0), count(*)
    INTO total_debit, total_credit, line_count
    FROM "journal_line" WHERE "entry_id" = entry;
  IF line_count < 2 OR total_debit <> total_credit THEN
    RAISE EXCEPTION 'journal entry % is not balanced (debit %, credit %, % lines)',
      entry, total_debit, total_credit, line_count
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE FUNCTION journal_entry_balanced_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM journal_assert_balanced(NEW."id");
  RETURN NULL;
END $$;

CREATE FUNCTION journal_line_balanced_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM journal_assert_balanced(NEW."entry_id");
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "journal_entry_balanced" AFTER INSERT ON "journal_entry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_entry_balanced_trigger();

CREATE CONSTRAINT TRIGGER "journal_line_balanced" AFTER INSERT ON "journal_line"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_line_balanced_trigger();

-- Append-only: a posted entry is never changed or deleted; mistakes are fixed with a
-- reversing entry. (The one allowed change: created_by_id cleared if a user is deleted.)
CREATE FUNCTION journal_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'journal_entry'
     AND (to_jsonb(NEW) - 'created_by_id') = (to_jsonb(OLD) - 'created_by_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'journal entries are append-only; post a reversing entry instead'
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER "journal_entry_append_only" BEFORE UPDATE OR DELETE ON "journal_entry"
  FOR EACH ROW EXECUTE FUNCTION journal_append_only();

CREATE TRIGGER "journal_line_append_only" BEFORE UPDATE OR DELETE ON "journal_line"
  FOR EACH ROW EXECUTE FUNCTION journal_append_only();

-- ─── Chart of accounts (system accounts; codes are used by src/features/ledger/accounts.ts) ───

INSERT INTO "ledger_account" ("id", "code", "name", "type", "system") VALUES
  (gen_random_uuid(), '1000', 'الصندوق (نقد)', 'asset', true),
  (gen_random_uuid(), '1010', 'مدفوعات البطاقة', 'asset', true),
  (gen_random_uuid(), '1020', 'المحافظ الإلكترونية والتحويلات', 'asset', true),
  (gen_random_uuid(), '1030', 'الحساب المصرفي', 'asset', true),
  (gen_random_uuid(), '1100', 'ذمم المرضى', 'asset', true),
  (gen_random_uuid(), '2000', 'ذمم المختبرات والموردين', 'liability', true),
  (gen_random_uuid(), '2100', 'دفعات مقدمة من المرضى', 'liability', true),
  (gen_random_uuid(), '2200', 'رواتب مستحقة', 'liability', true),
  (gen_random_uuid(), '3000', 'رأس المال', 'equity', true),
  (gen_random_uuid(), '4000', 'إيرادات العلاج', 'revenue', true),
  (gen_random_uuid(), '4100', 'خصومات ممنوحة', 'revenue', true),
  (gen_random_uuid(), '5000', 'مصاريف المختبر', 'expense', true),
  (gen_random_uuid(), '5100', 'الرواتب', 'expense', true),
  (gen_random_uuid(), '5200', 'العمولات', 'expense', true),
  (gen_random_uuid(), '5300', 'المستلزمات', 'expense', true),
  (gen_random_uuid(), '5800', 'عجز وزيادة الصندوق', 'expense', true),
  (gen_random_uuid(), '5900', 'مصاريف أخرى', 'expense', true);
