-- CreateEnum ContentType
CREATE TYPE "ContentType" AS ENUM ('LIVE', 'MOVIE', 'SERIES', 'RADIO');

-- Add contentType to channels
ALTER TABLE "channels" ADD COLUMN "contentType" "ContentType" NOT NULL DEFAULT 'LIVE';
ALTER TABLE "channels" ADD COLUMN "episodeId" TEXT;

-- Create series table
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "description" TEXT,
    "year" INTEGER,
    "genre" TEXT,
    "provider" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- Create seasons table
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "title" TEXT,
    "posterUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- Create episodes table
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");
CREATE UNIQUE INDEX "seasons_seriesId_seasonNumber_key" ON "seasons"("seriesId", "seasonNumber");
CREATE UNIQUE INDEX "episodes_seasonId_episodeNumber_key" ON "episodes"("seasonId", "episodeNumber");

-- Indexes
CREATE INDEX "series_title_idx" ON "series"("title");
CREATE INDEX "series_provider_idx" ON "series"("provider");
CREATE INDEX "series_genre_idx" ON "series"("genre");
CREATE INDEX "seasons_seriesId_idx" ON "seasons"("seriesId");
CREATE INDEX "episodes_seasonId_idx" ON "episodes"("seasonId");
CREATE INDEX "channels_contentType_idx" ON "channels"("contentType");
CREATE INDEX "channels_episodeId_idx" ON "channels"("episodeId");

-- Foreign keys
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channels" ADD CONSTRAINT "channels_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
