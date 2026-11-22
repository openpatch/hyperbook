-- Upgrade rebuilds were queued without a commit count (0), so the books list
-- counted every save of the book as unpublished. Each takes the count of the
-- first non-upgrade build up its replaces chain (same commit).
WITH RECURSIVE chain(id, ancestor) AS (
  SELECT id, replaces_build_id FROM builds WHERE trigger = 'upgrade' AND replaces_build_id IS NOT NULL
  UNION ALL
  SELECT chain.id, b.replaces_build_id FROM chain JOIN builds b ON b.id = chain.ancestor
  WHERE b.trigger = 'upgrade' AND b.replaces_build_id IS NOT NULL
)
UPDATE builds SET commit_count = (
  SELECT b.commit_count FROM chain JOIN builds b ON b.id = chain.ancestor
  WHERE chain.id = builds.id AND b.trigger <> 'upgrade'
)
WHERE trigger = 'upgrade' AND commit_count = 0 AND EXISTS (
  SELECT 1 FROM chain JOIN builds b ON b.id = chain.ancestor
  WHERE chain.id = builds.id AND b.trigger <> 'upgrade'
);
