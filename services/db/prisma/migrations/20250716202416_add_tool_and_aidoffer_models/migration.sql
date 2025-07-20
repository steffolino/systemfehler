/*
  Warnings:

  - The primary key for the `AidOffer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `address` on the `AidOffer` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `AidOffer` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `AidOffer` table. All the data in the column will be lost.
  - You are about to drop the column `opening` on the `AidOffer` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `AidOffer` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `AidOffer` table. All the data in the column will be lost.
  - The `topic` column on the `AidOffer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Benefit` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `preview` on the `Benefit` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `Benefit` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Benefit` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Benefit` table. All the data in the column will be lost.
  - The `topic` column on the `Benefit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Tool` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `description` on the `Tool` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Tool` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Tool` table. All the data in the column will be lost.
  - The `topic` column on the `Tool` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `summary_de` to the `AidOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary_en` to the `AidOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_de` to the `AidOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_en` to the `AidOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AidOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary_de` to the `Benefit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary_en` to the `Benefit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_de` to the `Benefit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_en` to the `Benefit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Benefit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary_de` to the `Tool` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary_en` to the `Tool` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_de` to the `Tool` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_en` to the `Tool` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Tool` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AidOffer" DROP CONSTRAINT "AidOffer_pkey",
DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "name",
DROP COLUMN "opening",
DROP COLUMN "source",
DROP COLUMN "url",
ADD COLUMN     "language" TEXT[],
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "summary_de" TEXT NOT NULL,
ADD COLUMN     "summary_en" TEXT NOT NULL,
ADD COLUMN     "title_de" TEXT NOT NULL,
ADD COLUMN     "title_en" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "topic",
ADD COLUMN     "topic" TEXT[],
ADD CONSTRAINT "AidOffer_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AidOffer_id_seq";

-- AlterTable
ALTER TABLE "Benefit" DROP CONSTRAINT "Benefit_pkey",
DROP COLUMN "preview",
DROP COLUMN "source",
DROP COLUMN "title",
DROP COLUMN "url",
ADD COLUMN     "language" TEXT[],
ADD COLUMN     "summary_de" TEXT NOT NULL,
ADD COLUMN     "summary_en" TEXT NOT NULL,
ADD COLUMN     "title_de" TEXT NOT NULL,
ADD COLUMN     "title_en" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "topic",
ADD COLUMN     "topic" TEXT[],
ADD CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Benefit_id_seq";

-- AlterTable
ALTER TABLE "Tool" DROP CONSTRAINT "Tool_pkey",
DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "provider",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "language" TEXT[],
ADD COLUMN     "summary_de" TEXT NOT NULL,
ADD COLUMN     "summary_en" TEXT NOT NULL,
ADD COLUMN     "title_de" TEXT NOT NULL,
ADD COLUMN     "title_en" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "topic",
ADD COLUMN     "topic" TEXT[],
ADD CONSTRAINT "Tool_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Tool_id_seq";

-- CreateTable
CREATE TABLE "RelatedLink" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "relation" TEXT,
    "proposedAsEntry" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "benefitId" TEXT,
    "toolId" TEXT,
    "aidOfferId" TEXT,

    CONSTRAINT "RelatedLink_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RelatedLink" ADD CONSTRAINT "RelatedLink_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "Benefit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedLink" ADD CONSTRAINT "RelatedLink_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedLink" ADD CONSTRAINT "RelatedLink_aidOfferId_fkey" FOREIGN KEY ("aidOfferId") REFERENCES "AidOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
