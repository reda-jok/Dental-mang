-- Arabic-aware fuzzy search (trigram index on patient.search_text).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Human-readable patient codes: P-000001, P-000002, ... (never count() + 1).
CREATE SEQUENCE IF NOT EXISTS "patient_code_seq" START 1;

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('xray', 'photo', 'document');

-- CreateTable
CREATE TABLE "patient" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT ('P-'::text || lpad((nextval('patient_code_seq'::regclass))::text, 6, '0'::text)),
    "full_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "birth_date" DATE,
    "birth_date_estimated" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "phone2" TEXT,
    "address" TEXT,
    "referral_source" TEXT,
    "notes" TEXT,
    "search_text" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_history" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "conditions" TEXT[],
    "other_conditions" TEXT,
    "allergies" TEXT[],
    "other_allergies" TEXT,
    "medications" TEXT,
    "pregnant" BOOLEAN NOT NULL DEFAULT false,
    "smoker" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "taken_at" DATE,
    "notes" TEXT,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_code_key" ON "patient"("code");

-- CreateIndex
CREATE INDEX "patient_phone_idx" ON "patient"("phone");

-- CreateIndex
CREATE INDEX "patient_created_at_idx" ON "patient"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "medical_history_patient_id_version_key" ON "medical_history"("patient_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_stored_name_key" ON "attachment"("stored_name");

-- CreateIndex
CREATE INDEX "attachment_patient_id_created_at_idx" ON "attachment"("patient_id", "created_at");

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Search: substring and similarity matching on the normalized text.
CREATE INDEX "patient_search_text_trgm_idx" ON "patient" USING GIN ("search_text" gin_trgm_ops);

-- The sequence belongs to the column (dropped with it).
ALTER SEQUENCE "patient_code_seq" OWNED BY "patient"."code";

-- Only one current version number per patient, and versions start at 1.
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_version_positive" CHECK ("version" >= 1);
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_size_positive" CHECK ("size_bytes" > 0);
