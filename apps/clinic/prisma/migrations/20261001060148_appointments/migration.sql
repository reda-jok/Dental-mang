-- Needed for exclusion constraints that mix "=" (uuid) and "&&" (time ranges).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "AppointmentPriority" AS ENUM ('normal', 'urgent');

-- AlterTable
ALTER TABLE "clinic_settings" ADD COLUMN     "day_end_minutes" INTEGER NOT NULL DEFAULT 1320,
ADD COLUMN     "day_start_minutes" INTEGER NOT NULL DEFAULT 930,
ADD COLUMN     "slot_minutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "weekly_off_days" INTEGER[] DEFAULT ARRAY[5]::INTEGER[];

-- CreateTable
CREATE TABLE "room" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "dentist_id" UUID,
    "room_id" UUID,
    "procedure_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending',
    "priority" "AppointmentPriority" NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_holiday" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_name_key" ON "room"("name");

-- CreateIndex
CREATE INDEX "appointment_starts_at_idx" ON "appointment"("starts_at");

-- CreateIndex
CREATE INDEX "appointment_patient_id_starts_at_idx" ON "appointment"("patient_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_holiday_date_key" ON "clinic_holiday"("date");

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_holiday" ADD CONSTRAINT "clinic_holiday_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Data guards ─────────────────────────────────────────────────────────────

ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_time_order" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "appointment_max_length" CHECK ("ends_at" - "starts_at" <= interval '12 hours');

-- No double-booking, enforced by the database even under concurrent requests:
-- a dentist (or a room) can't have two active appointments that overlap in time.
ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_dentist_no_overlap" EXCLUDE USING gist (
    "dentist_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("dentist_id" IS NOT NULL AND "status" IN ('pending', 'in_progress', 'completed')),
  ADD CONSTRAINT "appointment_room_no_overlap" EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("room_id" IS NOT NULL AND "status" IN ('pending', 'in_progress', 'completed'));

ALTER TABLE "clinic_settings"
  ADD CONSTRAINT "clinic_settings_hours_valid" CHECK (
    "day_start_minutes" >= 0 AND "day_end_minutes" <= 1440 AND "day_start_minutes" < "day_end_minutes"
  ),
  ADD CONSTRAINT "clinic_settings_slot_valid" CHECK ("slot_minutes" BETWEEN 5 AND 240),
  ADD CONSTRAINT "clinic_settings_off_days_valid" CHECK ("weekly_off_days" <@ ARRAY[0,1,2,3,4,5,6]);
