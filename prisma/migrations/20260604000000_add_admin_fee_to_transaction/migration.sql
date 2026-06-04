-- AddAdminFeeToTransaction
BEGIN;

ALTER TABLE "Transaction" ADD COLUMN "adminFee" DECIMAL(15,2) NOT NULL DEFAULT 0;

COMMIT;