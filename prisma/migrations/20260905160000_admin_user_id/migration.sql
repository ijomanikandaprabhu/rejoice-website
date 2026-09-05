-- Sign in with a short User ID as well as an email address.
--
-- Nullable and additive: the column must exist before any row can carry a
-- value. The UPDATE then fills in the single administrator.
ALTER TABLE "Admin" ADD COLUMN "userId" INTEGER;

CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- Addressed by "the oldest administrator" rather than a hard-coded id, so this
-- behaves identically on the local database and on Neon. Both hold exactly one
-- row; the LIMIT means a second one would be left alone rather than silently
-- given the same identity, which the unique index would reject anyway.
UPDATE "Admin"
SET "userId" = 1975
WHERE id = (SELECT id FROM "Admin" ORDER BY "createdAt" ASC LIMIT 1);
