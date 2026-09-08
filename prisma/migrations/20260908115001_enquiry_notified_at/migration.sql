-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "notifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Enquiry_notifiedAt_idx" ON "Enquiry"("notifiedAt");

-- Backfill: every enquiry that already exists WAS already notified.
--
-- Not cosmetic. Under the previous code the email was sent before the response,
-- so a stored row always had its notification attempted. Leaving these null
-- would make the new sweep read the entire existing inbox as unsent and email
-- the owner a copy of every enquiry from the past fortnight the first time the
-- daily job ran. That happened on a local database during testing: ten old test
-- enquiries were re-sent in one run.
--
-- createdAt is used as the timestamp because it is the closest true value we
-- have; the exact minute does not matter, only that the row is not pending.
UPDATE "Enquiry" SET "notifiedAt" = "createdAt" WHERE "notifiedAt" IS NULL;
