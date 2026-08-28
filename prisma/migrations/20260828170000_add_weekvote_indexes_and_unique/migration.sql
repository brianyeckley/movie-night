-- Every read of WeekVote filters on the week plus the round, and tallying
-- additionally groups by user. Without these the table is scanned in full on
-- each dashboard render, which happens every few seconds while a round is open.
CREATE INDEX "WeekVote_weekId_round_idx" ON "WeekVote"("weekId", "round");
CREATE INDEX "WeekVote_weekId_userId_round_idx" ON "WeekVote"("weekId", "userId", "round");

-- Collapse any duplicate vote rows before the unique index is enforced.
-- Submitting deletes the user's prior votes for the round and re-inserts, so
-- duplicates should not exist; a partially failed insert could leave some.
DELETE FROM "WeekVote"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "WeekVote"
  GROUP BY "weekId", "userId", "round", "targetId"
);

-- A user cannot cast the same vote twice within one round.
CREATE UNIQUE INDEX "WeekVote_weekId_userId_round_targetId_key"
  ON "WeekVote"("weekId", "userId", "round", "targetId");
