-- CreateTable
CREATE TABLE "clinical_note" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "appointment_id" UUID,
    "author_id" UUID,
    "visit_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,

    CONSTRAINT "clinical_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_note_version" (
    "id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "written_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_note_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_note_patient_id_visit_on_idx" ON "clinical_note"("patient_id", "visit_on");

-- CreateIndex
CREATE INDEX "clinical_note_appointment_id_idx" ON "clinical_note"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_note_version_note_id_version_key" ON "clinical_note_version"("note_id", "version");

-- AddForeignKey
ALTER TABLE "clinical_note" ADD CONSTRAINT "clinical_note_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note" ADD CONSTRAINT "clinical_note_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note" ADD CONSTRAINT "clinical_note_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note" ADD CONSTRAINT "clinical_note_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_version" ADD CONSTRAINT "clinical_note_version_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "clinical_note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_note_version" ADD CONSTRAINT "clinical_note_version_written_by_id_fkey" FOREIGN KEY ("written_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Clinical note guards ────────────────────────────────────────────────────

ALTER TABLE "clinical_note"
  ADD CONSTRAINT "clinical_note_deleted_by_needs_time" CHECK ("deleted_by_id" IS NULL OR "deleted_at" IS NOT NULL);

ALTER TABLE "clinical_note_version"
  ADD CONSTRAINT "clinical_note_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "clinical_note_version_body" CHECK (btrim("body") <> '' AND length("body") <= 5000);

-- A note keeps its patient, author, visit and signing time. The only change is deleting it
-- (soft, once, within 24 hours of signing), plus links cleared when a user or appointment
-- is removed. Rows are never deleted.
CREATE FUNCTION clinical_note_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable text[] := ARRAY['deleted_at', 'deleted_by_id', 'author_id', 'appointment_id'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'clinical notes can''t be deleted' USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable)
    OR (NEW."author_id" IS NOT NULL AND NEW."author_id" IS DISTINCT FROM OLD."author_id")
    OR (NEW."appointment_id" IS NOT NULL AND NEW."appointment_id" IS DISTINCT FROM OLD."appointment_id")
  THEN
    RAISE EXCEPTION 'a clinical note keeps its patient, author, visit and signing time'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."deleted_at" IS NOT NULL AND NEW."deleted_at" IS DISTINCT FROM OLD."deleted_at" THEN
    RAISE EXCEPTION 'a deleted clinical note stays deleted' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."deleted_at" IS NULL AND NEW."deleted_at" IS NOT NULL
    AND NEW."deleted_at" > OLD."created_at" + interval '24 hours'
  THEN
    RAISE EXCEPTION 'a clinical note can only be deleted within 24 hours of signing'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "clinical_note_guard" BEFORE UPDATE OR DELETE ON "clinical_note"
  FOR EACH ROW EXECUTE FUNCTION clinical_note_guard();

-- Versions are append-only, and a deleted note gets no new text.
CREATE TRIGGER "clinical_note_version_append_only" BEFORE UPDATE OR DELETE ON "clinical_note_version"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('written_by_id');

CREATE FUNCTION clinical_note_version_guard_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "clinical_note" WHERE "id" = NEW."note_id" AND "deleted_at" IS NOT NULL) THEN
    RAISE EXCEPTION 'a deleted clinical note can''t be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "clinical_note_version_guard_insert" BEFORE INSERT ON "clinical_note_version"
  FOR EACH ROW EXECUTE FUNCTION clinical_note_version_guard_insert();
