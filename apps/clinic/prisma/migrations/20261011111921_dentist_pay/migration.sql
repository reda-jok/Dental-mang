-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('salary', 'commission', 'both');

-- CreateTable
CREATE TABLE "dentist_pay" (
    "id" UUID NOT NULL,
    "dentist_id" UUID NOT NULL,
    "pay_type" "PayType" NOT NULL,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "monthly_salary" DECIMAL(14,2),
    "deduct_lab" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dentist_pay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dentist_pay_dentist_id_effective_from_idx" ON "dentist_pay"("dentist_id", "effective_from");

-- AddForeignKey
ALTER TABLE "dentist_pay" ADD CONSTRAINT "dentist_pay_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dentist_pay" ADD CONSTRAINT "dentist_pay_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Guards ──────────────────────────────────────────────────────────────────

ALTER TABLE "dentist_pay"
  ADD CONSTRAINT "dentist_pay_rate" CHECK ("commission_rate" >= 0 AND "commission_rate" <= 100),
  ADD CONSTRAINT "dentist_pay_salary" CHECK ("monthly_salary" IS NULL OR "monthly_salary" >= 0),
  ADD CONSTRAINT "dentist_pay_salary_needed" CHECK (
    "pay_type" = 'commission' OR "monthly_salary" IS NOT NULL),
  ADD CONSTRAINT "dentist_pay_month_start" CHECK (extract(day FROM "effective_from") = 1);

CREATE TRIGGER "dentist_pay_append_only" BEFORE UPDATE OR DELETE ON "dentist_pay"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('created_by_id');
