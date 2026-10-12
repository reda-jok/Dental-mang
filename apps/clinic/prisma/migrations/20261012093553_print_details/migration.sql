-- CreateEnum
CREATE TYPE "ReceiptPaper" AS ENUM ('A5', 'thermal80');

-- AlterTable
ALTER TABLE "clinic_settings" ADD COLUMN     "logo_file" TEXT,
ADD COLUMN     "receipt_paper" "ReceiptPaper" NOT NULL DEFAULT 'A5';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "name_en" TEXT,
ADD COLUMN     "speciality" TEXT,
ADD COLUMN     "speciality_en" TEXT;
