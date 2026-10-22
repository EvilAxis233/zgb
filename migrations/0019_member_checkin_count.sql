ALTER TABLE users ADD COLUMN member_checkin_count INTEGER NOT NULL DEFAULT 0 CHECK (member_checkin_count >= 0);
