-- Branding defaults for dynamic site identity
INSERT INTO "system_config" ("id", "key", "value", "updatedAt")
VALUES
  ('cfg_site_name', 'site_name', 'IPTV', NOW()),
  ('cfg_site_short_name', 'site_short_name', 'IPTV', NOW()),
  ('cfg_site_logo_url', 'site_logo_url', '/logo-dark.png', NOW()),
  ('cfg_site_logo_dark_url', 'site_logo_dark_url', '/logo-dark.png', NOW()),
  ('cfg_site_logo_light_url', 'site_logo_light_url', '/logo-white.png', NOW()),
  ('cfg_primary_color', 'primary_color', '#73de90', NOW()),
  ('cfg_featured_channel_uuid', 'featured_channel_uuid', '', NOW()),
  ('cfg_featured_banner_url', 'featured_banner_url', '', NOW()),
  ('cfg_support_email', 'support_email', 'suporte@iptv.local', NOW()),
  ('cfg_support_whatsapp', 'support_whatsapp', '', NOW()),
  ('cfg_pix_key', 'pix_key', 'suporte@iptv.local', NOW()),
  ('cfg_default_plan_id', 'default_plan_id', 'basico', NOW()),
  ('cfg_commission_default', 'commission_default', '0.20', NOW()),
  ('cfg_trial_days', 'trial_days', '7', NOW())
ON CONFLICT ("key") DO UPDATE
SET
  "value" = EXCLUDED."value",
  "updatedAt" = NOW();
