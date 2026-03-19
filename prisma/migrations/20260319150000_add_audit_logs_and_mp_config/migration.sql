CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'INFO',
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "message" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "actorRole" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

INSERT INTO "system_config" ("id", "key", "value", "updatedAt")
VALUES
  ('cfg_mp_access_token', 'mercadopago_access_token', '', NOW()),
  ('cfg_audit_retention_days', 'audit_retention_days', '90', NOW())
ON CONFLICT ("key") DO NOTHING;
