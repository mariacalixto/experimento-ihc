ALTER TABLE "Participant" ADD COLUMN "accessTokenHash" TEXT;
CREATE UNIQUE INDEX "Participant_accessTokenHash_key" ON "Participant"("accessTokenHash");
