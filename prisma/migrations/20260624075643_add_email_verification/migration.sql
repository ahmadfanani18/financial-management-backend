/*
  Warnings:

  - You are about to drop the column `date` on the `InvestmentTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `InvestmentTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `shares` on the `InvestmentTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `InvestmentTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `InvestmentTransaction` table. All the data in the column will be lost.
  - Added the required column `pricePerShare` to the `InvestmentTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `InvestmentTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transactionDate` to the `InvestmentTransaction` table without a default value. This is not possible if the table is not empty.
  - Made the column `holdingId` on table `InvestmentTransaction` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `type` on the `InvestmentTransaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CRYPTO', 'US_STOCK', 'IDX_STOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'BUY';
ALTER TYPE "TransactionType" ADD VALUE 'SELL';

-- DropIndex
DROP INDEX "InvestmentTransaction_userId_date_idx";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "balance" SET DEFAULT '0',
ALTER COLUMN "balance" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Budget" ALTER COLUMN "amount" SET DATA TYPE TEXT,
ALTER COLUMN "spent" SET DEFAULT '0',
ALTER COLUMN "spent" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "targetAmount" SET DATA TYPE TEXT,
ALTER COLUMN "currentAmount" SET DEFAULT '0',
ALTER COLUMN "currentAmount" SET DATA TYPE TEXT,
ALTER COLUMN "initialBalance" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "GoalContribution" ALTER COLUMN "amount" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "InvestmentTransaction" DROP COLUMN "date",
DROP COLUMN "price",
DROP COLUMN "shares",
DROP COLUMN "total",
DROP COLUMN "userId",
ADD COLUMN     "brokerFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "pricePerShare" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL,
ADD COLUMN     "transactionDate" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "holdingId" SET NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE TEXT,
ALTER COLUMN "finalAmount" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "PlanMilestone" ALTER COLUMN "targetAmount" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "deductGoals" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "amount" SET DATA TYPE TEXT,
ALTER COLUMN "adminFee" SET DEFAULT '0',
ALTER COLUMN "adminFee" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "price" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "avgBuyPrice" DECIMAL(65,30) NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'IDX_STOCK',
    "realizedPnL" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_symbol_key" ON "MarketPrice"("symbol");

-- CreateIndex
CREATE INDEX "MarketPrice_symbol_idx" ON "MarketPrice"("symbol");

-- CreateIndex
CREATE INDEX "Holding_accountId_idx" ON "Holding"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_symbol_key" ON "Holding"("accountId", "symbol");

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
