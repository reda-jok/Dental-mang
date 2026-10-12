-- CreateEnum
CREATE TYPE "VisitReason" AS ENUM ('checkup', 'consultation', 'emergency', 'other');

-- CreateEnum
CREATE TYPE "VisitOutcome" AS ENUM ('done', 'continued', 'not_done');

-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "reason" "VisitReason";

-- AlterTable
ALTER TABLE "procedure" ADD COLUMN     "visits_max" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "visits_min" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "appointment_item" (
    "appointment_id" UUID NOT NULL,
    "plan_item_id" UUID NOT NULL,
    "outcome" "VisitOutcome",

    CONSTRAINT "appointment_item_pkey" PRIMARY KEY ("appointment_id","plan_item_id")
);

-- CreateIndex
CREATE INDEX "appointment_item_plan_item_id_idx" ON "appointment_item"("plan_item_id");

-- AddForeignKey
ALTER TABLE "appointment_item" ADD CONSTRAINT "appointment_item_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_item" ADD CONSTRAINT "appointment_item_plan_item_id_fkey" FOREIGN KEY ("plan_item_id") REFERENCES "treatment_plan_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom: a procedure takes at least one visit, and the range is in order.
ALTER TABLE "procedure"
  ADD CONSTRAINT "procedure_visits" CHECK ("visits_min" BETWEEN 1 AND 99 AND "visits_max" BETWEEN "visits_min" AND 99);
