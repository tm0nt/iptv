ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "phone" TEXT;

CREATE TABLE IF NOT EXISTS "account_profiles" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "account_profiles_user_id_idx"
ON "account_profiles" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "account_profiles_user_default_idx"
ON "account_profiles" ("user_id")
WHERE "is_default" = TRUE;

CREATE TABLE IF NOT EXISTS "playback_sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subscription_id" TEXT REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "profile_id" TEXT NOT NULL REFERENCES "account_profiles"("id") ON DELETE CASCADE,
  "viewer_key" TEXT NOT NULL,
  "channel_uuid" TEXT,
  "channel_name" TEXT,
  "content_type" TEXT,
  "last_event" TEXT,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "playback_sessions_profile_id_idx"
ON "playback_sessions" ("profile_id");

CREATE INDEX IF NOT EXISTS "playback_sessions_user_id_last_seen_idx"
ON "playback_sessions" ("user_id", "last_seen_at");

CREATE TABLE IF NOT EXISTS "watch_progress" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "profile_id" TEXT NOT NULL REFERENCES "account_profiles"("id") ON DELETE CASCADE,
  "channel_uuid" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "progress_seconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duration_seconds" DOUBLE PRECISION,
  "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_live" BOOLEAN NOT NULL DEFAULT FALSE,
  "last_watched_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "watch_progress_profile_channel_idx"
ON "watch_progress" ("profile_id", "channel_uuid");

CREATE INDEX IF NOT EXISTS "watch_progress_profile_last_watched_idx"
ON "watch_progress" ("profile_id", "last_watched_at" DESC);
