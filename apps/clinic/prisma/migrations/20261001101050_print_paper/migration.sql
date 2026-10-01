-- CreateEnum
CREATE TYPE "PrintPaper" AS ENUM ('A5', 'A4');

-- AlterTable
ALTER TABLE "clinic_settings" ADD COLUMN     "print_paper" "PrintPaper" NOT NULL DEFAULT 'A5';
