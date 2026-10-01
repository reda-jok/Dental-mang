-- CreateEnum
CREATE TYPE "MedicationForm" AS ENUM ('tablet', 'capsule', 'syrup', 'suspension', 'mouthwash', 'gel', 'ointment', 'drops', 'injection', 'other');

-- CreateTable
CREATE TABLE "medication" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "form" "MedicationForm" NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "group" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "prescribed_by_id" UUID,
    "issued_on" DATE NOT NULL,
    "notes" TEXT,
    "acknowledged" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_item" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "medication_id" UUID,
    "name" TEXT NOT NULL,
    "form" "MedicationForm",
    "dose" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "notes" TEXT,

    CONSTRAINT "prescription_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medication_name_key" ON "medication"("name");

-- CreateIndex
CREATE INDEX "prescription_patient_id_issued_on_idx" ON "prescription"("patient_id", "issued_on");

-- CreateIndex
CREATE INDEX "prescription_item_prescription_id_idx" ON "prescription_item"("prescription_id");

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_prescribed_by_id_fkey" FOREIGN KEY ("prescribed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_item" ADD CONSTRAINT "prescription_item_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_item" ADD CONSTRAINT "prescription_item_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
