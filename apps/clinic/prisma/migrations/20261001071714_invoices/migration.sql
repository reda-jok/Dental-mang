-- Invoice numbers come from a sequence (INV-<year>-000123), never count() + 1.
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" START 1;

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('visit', 'plan');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('issued', 'void');

-- AlterTable
ALTER TABLE "clinic_settings" ADD COLUMN     "invoice_due_days" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "treatment_plan_item" ADD COLUMN     "invoice_id" UUID;

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "patient_id" UUID NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "plan_id" UUID,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'issued',
    "currency" "Currency" NOT NULL DEFAULT 'IQD',
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "extra_discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "journal_entry_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "plan_item_id" UUID,
    "procedure_id" UUID,
    "description" TEXT NOT NULL,
    "tooth" INTEGER,
    "surfaces" TEXT[],
    "dentist_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_number_key" ON "invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_journal_entry_id_key" ON "invoice"("journal_entry_id");

-- CreateIndex
CREATE INDEX "invoice_patient_id_issue_date_idx" ON "invoice"("patient_id", "issue_date");

-- CreateIndex
CREATE INDEX "invoice_status_due_date_idx" ON "invoice"("status", "due_date");

-- CreateIndex
CREATE INDEX "invoice_issue_date_idx" ON "invoice"("issue_date");

-- CreateIndex
CREATE INDEX "invoice_line_invoice_id_idx" ON "invoice_line"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_line_plan_item_id_idx" ON "invoice_line"("plan_item_id");

-- CreateIndex
CREATE INDEX "invoice_line_dentist_id_idx" ON "invoice_line"("dentist_id");

-- CreateIndex
CREATE INDEX "treatment_plan_item_invoice_id_idx" ON "treatment_plan_item"("invoice_id");

-- AddForeignKey
ALTER TABLE "treatment_plan_item" ADD CONSTRAINT "treatment_plan_item_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "treatment_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_plan_item_id_fkey" FOREIGN KEY ("plan_item_id") REFERENCES "treatment_plan_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Billing guards ──────────────────────────────────────────────────────────

ALTER TABLE "clinic_settings"
  ADD CONSTRAINT "clinic_settings_invoice_due_days_valid" CHECK ("invoice_due_days" BETWEEN 0 AND 365);

ALTER TABLE "invoice"
  ADD CONSTRAINT "invoice_amounts_valid" CHECK (
    "subtotal" >= 0 AND "extra_discount" >= 0 AND "discount_total" >= "extra_discount"
    AND "total" = "subtotal" - "discount_total" AND "total" >= 0
  ),
  ADD CONSTRAINT "invoice_due_after_issue" CHECK ("due_date" >= "issue_date"),
  ADD CONSTRAINT "invoice_plan_kind" CHECK ("kind" <> 'plan' OR "plan_id" IS NOT NULL),
  ADD CONSTRAINT "invoice_void_recorded" CHECK (
    ("status" = 'void') = ("voided_at" IS NOT NULL)
    AND ("status" <> 'void' OR "void_reason" IS NOT NULL)
  );

ALTER TABLE "invoice_line"
  ADD CONSTRAINT "invoice_line_amounts_valid" CHECK (
    "quantity" BETWEEN 1 AND 99 AND "unit_price" >= 0 AND "discount" >= 0
    AND "total" = "quantity" * "unit_price" - "discount" AND "total" >= 0
  ),
  ADD CONSTRAINT "invoice_line_has_source" CHECK ("plan_item_id" IS NOT NULL OR "procedure_id" IS NOT NULL);

-- An issued invoice is a document: amounts, lines and dates never change. The only
-- update allowed is voiding it (once), plus clearing user links if a user is deleted.
CREATE FUNCTION invoice_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable text[] := ARRAY['status', 'voided_at', 'voided_by_id', 'void_reason', 'created_by_id'];
BEGIN
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'issued invoices can''t be edited; void the invoice instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."status" = 'void' AND (
    NEW."status" <> 'void' OR NEW."voided_at" IS DISTINCT FROM OLD."voided_at"
    OR NEW."void_reason" IS DISTINCT FROM OLD."void_reason"
  ) THEN
    RAISE EXCEPTION 'a void invoice can''t be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "invoice_guard_update" BEFORE UPDATE ON "invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_guard_update();

-- Rows that are never changed or deleted (only a user link may be cleared).
CREATE FUNCTION forbid_change_except_user_links() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  links text[] := TG_ARGV;
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - links) = (to_jsonb(OLD) - links) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% rows can''t be changed or deleted', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER "invoice_no_delete" BEFORE DELETE ON "invoice"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links();

CREATE TRIGGER "invoice_line_append_only" BEFORE UPDATE OR DELETE ON "invoice_line"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('dentist_id');
