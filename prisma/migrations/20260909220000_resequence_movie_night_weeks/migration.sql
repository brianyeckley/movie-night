-- Resequence weekNumber in MovieNightWeek to be strictly sequential (1..N) based on createdAt.
-- Assign temporary negative numbers first to avoid unique constraint violations on weekNumber.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY createdAt ASC) as new_num
  FROM MovieNightWeek
)
UPDATE MovieNightWeek
SET weekNumber = -(SELECT new_num FROM numbered WHERE numbered.id = MovieNightWeek.id);

UPDATE MovieNightWeek
SET weekNumber = -weekNumber
WHERE weekNumber < 0;
