-- Notifications shown behind the admin's bell.
--
-- Separate from enquiries on purpose: an enquiry is correspondence with a
-- person and is kept, a notification is a note that something happened and is
-- swept after seven days.

CREATE TYPE "NotificationKind" AS ENUM ('ENQUIRY', 'SYNC');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- The unread count and the newest-first list.
CREATE INDEX "Notification_readAt_createdAt_idx" ON "Notification"("readAt", "createdAt");

-- The seven-day sweep.
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
