-- Every film in the Legacy category has already been watched -- that is what
-- makes it eligible for the Legacy re-watch voting pool -- but most were never
-- flagged, so they rendered without the Watched marker.
UPDATE Movie
SET watched = true
WHERE watched = false
  AND categoryId IN (SELECT id FROM Category WHERE name = 'Legacy');
