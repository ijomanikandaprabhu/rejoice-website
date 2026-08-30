-- Narrows EnquiryStatus from (NEW, READ, RESOLVED) to (NEW, READ).
--
-- An enquiry is now either new or seen. "Resolved" meant "dealt with", and that
-- distinction is DELETED by this migration, not preserved anywhere: on
-- 27 August 2026 the 88 rows then marked RESOLVED were folded into READ and are
-- indistinguishable from ordinary read enquiries afterwards.
--
-- Order matters. Postgres refuses to drop an enum value while any row still
-- uses it, so the rows are converted first. And Postgres has no
-- `ALTER TYPE ... DROP VALUE`, hence the rename/recreate/re-point dance rather
-- than a one-line change.

-- 1. Fold RESOLVED into READ while the value still exists.
UPDATE "Enquiry" SET "status" = 'READ' WHERE "status" = 'RESOLVED';

-- 2. Rebuild the type without RESOLVED.
ALTER TYPE "EnquiryStatus" RENAME TO "EnquiryStatus_old";
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'READ');

-- The default has to go before the column can change type, and come back after.
ALTER TABLE "Enquiry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Enquiry"
  ALTER COLUMN "status" TYPE "EnquiryStatus" USING ("status"::text::"EnquiryStatus");
ALTER TABLE "Enquiry" ALTER COLUMN "status" SET DEFAULT 'NEW';

DROP TYPE "EnquiryStatus_old";
