import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

test('database schema includes the release data model', async () => {
  const schema = await read('backend/src/schema.sql');
  for (const table of ['users', 'integrations', 'sites', 'events', 'uptime_checks', 'external_metrics', 'conversion_goals', 'audit_log']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(schema, /visitor_hash/);
  assert.match(schema, /metric_values/);
});

test('API exposes health, GitHub discovery, tracker and reporting routes', async () => {
  const server = await read('backend/src/server.js');
  for (const route of ['/api/health', '/api/auth/github', '/api/sites/import', '/api/collect', '/api/analytics/overview', '/api/analytics/series', '/api/analytics/pages', '/api/analytics/errors', '/api/uptime/check-all', '/api/reports/events.csv']) {
    assert.ok(server.includes(route), `Missing route ${route}`);
  }
  assert.match(server, /scope','read:user'/);
  assert.doesNotMatch(server, /scope','[^']*(?:public_repo|repo)(?:,|')/);
});

test('tracking is consent-gated and does not persist a visitor id before consent', async () => {
  const tracker = await read('tracker/webcontrol.js');
  assert.match(tracker, /let granted = false/);
  assert.match(tracker, /if\(!granted\) return/);
  assert.match(tracker, /if\(!visitorId\)visitorId=getVisitor\(\)/);
  assert.match(tracker, /command==='consent'&&name==='grant'/);
  assert.match(tracker, /command==='consent'&&name==='revoke'/);
});

test('GitHub Pages and scheduled monitoring workflows are present', async () => {
  const pages = await read('.github/workflows/pages.yml');
  const uptime = await read('.github/workflows/uptime-monitor.yml');
  assert.match(pages, /actions\/deploy-pages/);
  assert.match(pages, /path: frontend/);
  assert.match(uptime, /cron: '\*\/10 \* \* \* \*'/);
  assert.match(uptime, /WEBCONTROL_MONITOR_SECRET/);
});
