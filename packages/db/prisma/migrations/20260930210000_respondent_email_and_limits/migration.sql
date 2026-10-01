ALTER TABLE "Form" ADD COLUMN "limitOneResponsePerEmail" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Submission" ADD COLUMN "respondentEmail" TEXT;

CREATE INDEX "Submission_formId_respondentEmail_idx" ON "Submission"("formId", "respondentEmail");

CREATE INDEX "Submission_formId_respondentEmail_key" ON "Submission"("formId", lower("respondentEmail")) WHERE "respondentEmail" IS NOT NULL;
