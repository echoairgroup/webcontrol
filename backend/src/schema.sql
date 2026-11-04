CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  login TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  html_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_repo TEXT,
  github_url TEXT,
  github_default_branch TEXT,
  is_github_pages BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  tracking_key TEXT NOT NULL UNIQUE,
  tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ga4_property_id TEXT,
  search_console_site_url TEXT,
  last_status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  last_response_ms INTEGER,
  last_http_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, url)
);
CREATE INDEX IF NOT EXISTS sites_user_idx ON sites(user_id);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  referrer_host TEXT,
  source TEXT NOT NULL DEFAULT 'Direct',
  device TEXT NOT NULL DEFAULT 'Unknown',
  browser TEXT NOT NULL DEFAULT 'Unknown',
  os TEXT NOT NULL DEFAULT 'Unknown',
  country TEXT NOT NULL DEFAULT 'Unknown',
  session_hash TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  custom_name TEXT,
  duration_ms INTEGER,
  lcp_ms NUMERIC(10,2),
  cls NUMERIC(10,4),
  inp_ms NUMERIC(10,2),
  error_type TEXT,
  error_message TEXT,
  event_properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS events_site_created_idx ON events(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_site_name_created_idx ON events(site_id, event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS uptime_checks (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('up','down')),
  response_ms INTEGER,
  http_status INTEGER,
  error TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS uptime_site_checked_idx ON uptime_checks(site_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS external_metrics (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  metric_date DATE NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  metric_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, provider, metric_date, dimensions)
);
CREATE INDEX IF NOT EXISTS external_metrics_site_provider_date_idx ON external_metrics(site_id, provider, metric_date DESC);

CREATE TABLE IF NOT EXISTS conversion_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, event_name)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
