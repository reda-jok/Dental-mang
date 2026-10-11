-- CreateTable
CREATE TABLE "appointment_reminder" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "sent_by_id" UUID,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_reminder_appointment_id_sent_at_idx" ON "appointment_reminder"("appointment_id", "sent_at");

-- AddForeignKey
ALTER TABLE "appointment_reminder" ADD CONSTRAINT "appointment_reminder_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_reminder" ADD CONSTRAINT "appointment_reminder_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Guards ──────────────────────────────────────────────────────────────────

ALTER TABLE "appointment_reminder"
  ADD CONSTRAINT "appointment_reminder_channel" CHECK ("channel" IN ('whatsapp'));

CREATE TRIGGER "appointment_reminder_append_only" BEFORE UPDATE OR DELETE ON "appointment_reminder"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('sent_by_id');
