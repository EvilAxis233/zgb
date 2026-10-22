ALTER TABLE users ADD COLUMN checkin_streak INTEGER NOT NULL DEFAULT 0 CHECK (checkin_streak >= 0);

-- Existing check-ins count as day one; earlier consecutive days were not recorded.
UPDATE users SET checkin_streak=1 WHERE last_checkin IS NOT NULL;
