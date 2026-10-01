-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('IQD', 'USD');

-- CreateEnum
CREATE TYPE "ToothScope" AS ENUM ('none', 'tooth', 'surfaces');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('proposed', 'accepted', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('planned', 'in_progress', 'done', 'cancelled');

-- CreateTable
CREATE TABLE "procedure_category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "procedure_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'IQD',
    "tooth_scope" "ToothScope" NOT NULL DEFAULT 'tooth',
    "chart_result" TEXT,
    "duration_minutes" INTEGER,
    "requires_lab" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tooth_finding" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "tooth" INTEGER NOT NULL,
    "surfaces" TEXT[],
    "condition" TEXT NOT NULL,
    "notes" TEXT,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "tooth_finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plan" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'proposed',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),

    CONSTRAINT "treatment_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plan_item" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "procedure_id" UUID NOT NULL,
    "tooth" INTEGER,
    "surfaces" TEXT[],
    "phase" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "PlanItemStatus" NOT NULL DEFAULT 'planned',
    "dentist_id" UUID,
    "notes" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "treatment_plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procedure_category_name_key" ON "procedure_category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_category_id_name_key" ON "procedure"("category_id", "name");

-- CreateIndex
CREATE INDEX "tooth_finding_patient_id_idx" ON "tooth_finding"("patient_id");

-- CreateIndex
CREATE INDEX "treatment_plan_patient_id_created_at_idx" ON "treatment_plan"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "treatment_plan_item_plan_id_idx" ON "treatment_plan_item"("plan_id");

-- AddForeignKey
ALTER TABLE "procedure" ADD CONSTRAINT "procedure_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "procedure_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure" ADD CONSTRAINT "procedure_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tooth_finding" ADD CONSTRAINT "tooth_finding_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tooth_finding" ADD CONSTRAINT "tooth_finding_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan" ADD CONSTRAINT "treatment_plan_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan" ADD CONSTRAINT "treatment_plan_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan_item" ADD CONSTRAINT "treatment_plan_item_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "treatment_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan_item" ADD CONSTRAINT "treatment_plan_item_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan_item" ADD CONSTRAINT "treatment_plan_item_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Data guards (enforced by the database, not just the app) ────────────────

-- Valid FDI tooth numbers: permanent 11–18, 21–28, 31–38, 41–48; primary 51–55 … 81–85.
CREATE FUNCTION is_fdi_tooth(t integer) RETURNS boolean IMMUTABLE LANGUAGE sql AS $$
  SELECT (t / 10 BETWEEN 1 AND 4 AND t % 10 BETWEEN 1 AND 8)
      OR (t / 10 BETWEEN 5 AND 8 AND t % 10 BETWEEN 1 AND 5)
$$;

ALTER TABLE "tooth_finding"
  ADD CONSTRAINT "tooth_finding_tooth_valid" CHECK (is_fdi_tooth("tooth")),
  ADD CONSTRAINT "tooth_finding_surfaces_valid" CHECK ("surfaces" <@ ARRAY['M','D','O','B','L']::text[]);

ALTER TABLE "treatment_plan_item"
  ADD CONSTRAINT "plan_item_tooth_valid" CHECK ("tooth" IS NULL OR is_fdi_tooth("tooth")),
  ADD CONSTRAINT "plan_item_surfaces_valid" CHECK ("surfaces" <@ ARRAY['M','D','O','B','L']::text[]),
  ADD CONSTRAINT "plan_item_price_valid" CHECK ("price" >= 0),
  ADD CONSTRAINT "plan_item_discount_valid" CHECK ("discount" >= 0 AND "discount" <= "price"),
  ADD CONSTRAINT "plan_item_phase_valid" CHECK ("phase" BETWEEN 1 AND 20);

ALTER TABLE "procedure"
  ADD CONSTRAINT "procedure_price_valid" CHECK ("price" >= 0),
  ADD CONSTRAINT "procedure_duration_valid" CHECK ("duration_minutes" IS NULL OR "duration_minutes" BETWEEN 5 AND 600);
