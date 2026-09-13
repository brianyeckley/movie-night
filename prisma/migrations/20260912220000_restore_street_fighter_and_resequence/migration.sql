-- 1. Restore 'The Street Fighter' (1974) movie
INSERT OR IGNORE INTO Movie (
  id,
  title,
  imdbUrl,
  trailerUrl,
  year,
  director,
  stars,
  runtime,
  plot,
  posterUrl,
  imdbRating,
  watched,
  physical4K,
  physicalBluRay,
  physicalDvd,
  categoryId,
  createdAt
) VALUES (
  '9fe84d40-9918-4bc7-b807-20051a551f8b',
  'The Street Fighter',
  'https://www.imdb.com/title/tt0073756/',
  'https://www.youtube.com/watch?v=lFDDMAJDNfA',
  1974,
  'Shigehiro Ozawa',
  'Shin''ichi Chiba, Goichi Yamada, Yutaka Nakajima',
  '91 min',
  'After failing to reach a deal with her enemies, a mercenary karateka protects the daughter of a recently-deceased oil tycoon from the evil conglomerate gunning for her inheritance.',
  'https://m.media-amazon.com/images/M/MV5BY2ZmNmE5ODgtY2JiMi00OTY0LTg2OTYtMmNmMmVlNGMyOTA2XkEyXkFqcGc@._V1_SX300.jpg',
  '6.9',
  1,
  0,
  1,
  0,
  'd79d9aab-5c81-453f-a8d4-ec8ee2c3ab1a',
  '2026-06-04T20:05:35.426+00:00'
);

-- 2. Link genres for 'The Street Fighter' (Action, Crime, Martial Arts)
INSERT OR IGNORE INTO _GenreToMovie (A, B) VALUES
  ('58d5223e-0393-4e6e-9f8b-1f8036c60f3d', '9fe84d40-9918-4bc7-b807-20051a551f8b'),
  ('2f5d91d3-c51c-4a8f-9c39-a15a6f84cda3', '9fe84d40-9918-4bc7-b807-20051a551f8b'),
  ('genre-martial-arts-uuid', '9fe84d40-9918-4bc7-b807-20051a551f8b');

-- 3. Restore the deleted movie night week for 'The Street Fighter'
INSERT OR IGNORE INTO MovieNightWeek (
  id,
  weekNumber,
  status,
  themeCategoryId,
  selectedCategoryId,
  selectedSubcategoryId,
  winningMovieId,
  isRandomlyChosen,
  isInPerson,
  createdAt,
  closedAt
) VALUES (
  '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40',
  -999,
  'COMPLETED',
  '1de62e05-8840-4452-bfe6-1022bb0197d4',
  'd79d9aab-5c81-453f-a8d4-ec8ee2c3ab1a',
  NULL,
  '9fe84d40-9918-4bc7-b807-20051a551f8b',
  0,
  0,
  '2026-08-02T18:55:00.000+00:00',
  '2026-08-06T22:00:00.000+00:00'
);

-- 4. Restore the 8 votes cast for that week
INSERT OR IGNORE INTO WeekVote (id, weekId, userId, round, targetId, createdAt) VALUES
  ('e3f3ff5e-815e-47c9-bd50-2ed4deaa08f1', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', '5480331a-b469-493f-aa26-4af25fbb1c2e', 'ROUND_1_CATEGORY', 'd79d9aab-5c81-453f-a8d4-ec8ee2c3ab1a', '2026-08-02T18:56:02.687+00:00'),
  ('0a2b0582-c9cf-4353-ab82-a9c54875426e', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', '17f332f2-b420-41eb-bace-ad3cd9fe323b', 'ROUND_1_CATEGORY', 'd79d9aab-5c81-453f-a8d4-ec8ee2c3ab1a', '2026-08-02T19:46:45.519+00:00'),
  ('abec3c0a-d718-4ecf-bdc7-2ec9ecd19a10', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', '17f332f2-b420-41eb-bace-ad3cd9fe323b', 'ROUND_2_MOVIE', 'd4ddc959-5a43-44bf-b6a7-4ae934194716', '2026-08-02T19:52:10.535+00:00'),
  ('cd97b481-f2ca-4e22-91e4-0016c1eafa06', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', '17f332f2-b420-41eb-bace-ad3cd9fe323b', 'ROUND_2_MOVIE', '9fe84d40-9918-4bc7-b807-20051a551f8b', '2026-08-02T19:52:10.570+00:00'),
  ('c4e4e687-2658-49cc-ad2b-36922ff2de8f', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', '5480331a-b469-493f-aa26-4af25fbb1c2e', 'ROUND_2_MOVIE', '9fe84d40-9918-4bc7-b807-20051a551f8b', '2026-08-02T19:58:59.317+00:00'),
  ('cc271dcd-dbdc-4a43-b41e-c01fe9b8ee5e', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', '5480331a-b469-493f-aa26-4af25fbb1c2e', 'ROUND_2_MOVIE', '63b488e1-9c45-47ad-8ab2-a5054f4198b2', '2026-08-02T19:58:59.859+00:00'),
  ('8e49c1d5-aad9-480d-a23e-4f08ac4e03f3', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', 'cd7f53b2-8dcf-4024-aa24-5d4eb4e64fdc', 'ROUND_2_MOVIE', 'de654b62-dc7f-421e-b9b4-542006bed416', '2026-08-02T20:15:26.166+00:00'),
  ('a09cf831-0601-42dc-85d6-6bd8b9d21ccb', '03e337c5-8ee9-4bcf-be5c-fe8dd7397d40', 'cd7f53b2-8dcf-4024-aa24-5d4eb4e64fdc', 'ROUND_2_MOVIE', 'fc4b6b23-b3c8-4496-8cfa-2aa0f3a1f524', '2026-08-02T20:15:26.729+00:00');

-- 5. Backdate 'The Man Who Fell to Earth' week and movie createdAt to match watch date
UPDATE MovieNightWeek
SET createdAt = '2026-09-03T20:00:00.000+00:00'
WHERE id = '56905da7-ab20-43cb-9742-358a1a15486a';

UPDATE Movie
SET createdAt = '2026-09-03T20:00:00.000+00:00'
WHERE id = 'c0e2cd05-2031-4dc4-8eea-b59081eb14ea';

-- 6. Resequence weekNumber in MovieNightWeek based on watch/close date (or createdAt if not closed)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(closedAt, createdAt) ASC) as new_num
  FROM MovieNightWeek
)
UPDATE MovieNightWeek
SET weekNumber = -(SELECT new_num FROM numbered WHERE numbered.id = MovieNightWeek.id);

UPDATE MovieNightWeek
SET weekNumber = -weekNumber
WHERE weekNumber < 0;
