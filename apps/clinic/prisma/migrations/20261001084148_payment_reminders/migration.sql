-- CreateTable
CREATE TABLE "payment_reminder" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "sent_by_id" UUID,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_reminder_patient_id_sent_at_idx" ON "payment_reminder"("patient_id", "sent_at");

-- AddForeignKey
ALTER TABLE "payment_reminder" ADD CONSTRAINT "payment_reminder_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder" ADD CONSTRAINT "payment_reminder_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Guards ──────────────────────────────────────────────────────────────────

ALTER TABLE "payment_reminder"
  ADD CONSTRAINT "payment_reminder_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "payment_reminder_channel" CHECK ("channel" IN ('whatsapp'));

CREATE TRIGGER "payment_reminder_append_only" BEFORE UPDATE OR DELETE ON "payment_reminder"
  FOR EACH ROW EXECUTE FUNCTION forbid_change_except_user_links('sent_by_id');
