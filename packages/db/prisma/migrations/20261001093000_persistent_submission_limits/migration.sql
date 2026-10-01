CREATE TABLE "SubmissionRateLimit" (
  "key" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SubmissionRateLimit_pkey" PRIMARY KEY ("key")
);
