-- Lab case numbers come from a sequence (LAB-<year>-000123), never count() + 1.
CREATE SEQUENCE IF NOT EXISTS "lab_case_number_seq" START 1;

-- CreateEnum
CREATE TYPE "LabCaseStatus" AS ENUM ('sent', 'received', 'fitted', 'cancelled');

-- CreateTable
CREATE TABLE "lab" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "contact_name" TEXT,
    "turnaround_days" INTEGER NOT NULL DEFAULT 7,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_case" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "patient_id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "dentist_id" UUID,
    "plan_item_id" UUID,
    "work" TEXT NOT NULL,
    "teeth" INTEGER[],
    "shade" TEXT,
    "material" TEXT,
    "instructions" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "LabCaseStatus" NOT NULL DEFAULT 'sent',
    "sent_on" DATE NOT NULL,
    "due_on" DATE NOT NULL,
    "received_on" DATE,
    "fitted_on" DATE,
    "remakes" INTEGER NOT NULL DEFAULT 0,
    "cancel_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lab_case_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_name_key" ON "lab"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lab_case_number_key" ON "lab_case"("number");

-- CreateIndex
CREATE INDEX "lab_case_status_due_on_idx" ON "lab_case"("status", "due_on");

-- CreateIndex
CREATE INDEX "lab_case_patient_id_idx" ON "lab_case"("patient_id");

-- CreateIndex
CREATE INDEX "lab_case_lab_id_received_on_idx" ON "lab_case"("lab_id", "received_on");

-- AddForeignKey
ALTER TABLE "lab_case" ADD CONSTRAINT "lab_case_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_case" ADD CONSTRAINT "lab_case_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_case" ADD CONSTRAINT "lab_case_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_case" ADD CONSTRAINT "lab_case_plan_item_id_fkey" FOREIGN KEY ("plan_item_id") REFERENCES "treatment_plan_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_case" ADD CONSTRAINT "lab_case_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Guards ──────────────────────────────────────────────────────────────────

ALTER TABLE "lab"
  ADD CONSTRAINT "lab_turnaround_valid" CHECK ("turnaround_days" BETWEEN 1 AND 90);

ALTER TABLE "lab_case"
  ADD CONSTRAINT "lab_case_cost_valid" CHECK ("cost" >= 0),
  ADD CONSTRAINT "lab_case_dates_valid" CHECK (
    "due_on" >= "sent_on"
    AND ("received_on" IS NULL OR "received_on" >= "sent_on")
    AND ("fitted_on" IS NULL OR "received_on" IS NOT NULL)
  ),
  ADD CONSTRAINT "lab_case_status_dates" CHECK (
    ("status" <> 'received' OR "received_on" IS NOT NULL)
    AND ("status" <> 'fitted' OR "fitted_on" IS NOT NULL)
    AND ("status" <> 'cancelled' OR "cancel_reason" IS NOT NULL)
  );
