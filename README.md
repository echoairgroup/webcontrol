# WebControl — Website Command Center

Release 1.0.0 · React-free static frontend + Node API + Neon PostgreSQL

WebControl is a private dashboard for discovering and monitoring GitHub Pages sites and custom websites from one place. It combines GitHub Pages inventory, first-party consent-gated analytics, performance events, uptime checks, client-side error monitoring, CSV exports, and optional read-only Google Analytics 4 / Search Console imports.

## Important capabilities and boundaries

- **GitHub discovery:** lists repositories available to the connected GitHub account and imports repositories where GitHub Pages is enabled. Discovery is read-only. It does not edit site source files or change Pages settings.
- **Own analytics:** the tracker collects page views, custom events, supported browser performance timings and JavaScript errors after the visitor has granted analytics consent.
- **Uptime:** the Render API can check every registered URL. A GitHub Actions workflow runs a scheduled check every 10 minutes after you add two repository secrets. GitHub scheduled jobs can be delayed by GitHub, so this is monitoring rather than a contractual SLA.
- **Google:** optional Google OAuth connects GA4 and Search Console with read-only scopes. Property mapping and sync are exposed by the API; the dashboard's connector setup is ready for configuration.
- **Privacy:** raw visitor IP addresses are not written to the database. URL query strings, form contents and common personal-data property names are excluded. You are responsible for providing the appropriate privacy notice and collecting valid consent for each website and jurisdiction.
- **Management:** WebControl manages its own monitoring configuration. It does not delete, publish, edit or otherwise change your GitHub repositories or live websites.


## Release 1.0 scope and limitations

- GitHub discovery is read-only and limited to public repositories visible to the connected account. Private repository discovery needs a separately configured GitHub App with read-only repository metadata / Pages permissions.
- WebControl can manage the inventory, monitoring configuration and tracker keys for sites in its own workspace. It does not edit website source code, change GitHub Pages settings, trigger deployments or modify existing live websites.
- First-party visitor analytics begin only after the tracker snippet is installed and each visitor grants analytics consent. Existing traffic is not retroactively available unless it is imported from GA4.
- SEO metrics require a linked Search Console property. GA4 metrics require a linked Analytics property. The integrations are optional and read-only.
- Performance measurements are browser field samples and may be unavailable until enough consenting visits have been recorded. Country data depends on a supported edge-proxy country header; otherwise it is recorded as `Unknown`.
- Uptime checks monitor public HTTPS URLs and API health endpoints that you add as monitored URLs. This release does not yet retrieve Render service logs/deploy metrics or Neon compute/SQL metrics from their provider control planes; those require separate provider API integrations.
- Real analytics are never fabricated. Empty reports remain empty until a website sends data or an external provider sync succeeds.

## Architecture

| Layer | Technology |
|---|---|
| Dashboard | Static HTML, CSS and JavaScript on GitHub Pages |
| API | Node.js + Express on Render |
| Database | Neon PostgreSQL (EU Central / Frankfurt) |
| Repository discovery | GitHub OAuth + GitHub REST API |
| Visitor data | First-party WebControl tracker |
| External analytics | Google Analytics Data API + Search Console API |
| Scheduled checks | GitHub Actions (`*/10 * * * *`) |

GitHub Pages only serves static assets. Keep all OAuth secrets, database credentials and signing keys in Render environment variables; never put them in `frontend/config.js`.

## Local development

1. Create a Neon database and copy its **pooled** connection string. WebControl's dedicated Neon project has already been provisioned and its schema initialized; use its connection string when configuring the Render service.
2. Copy `backend/.env.example` to `backend/.env` (or use the root `.env.example`) and fill the environment variables.
3. Configure a GitHub OAuth App with callback `https://YOUR-RENDER-SERVICE.onrender.com/api/auth/github/callback`. Request `read:user` only. WebControl limits discovery to public repositories and fetches public Pages metadata without an OAuth token, so it does not need broad repository write scopes.
4. In `frontend/config.js`, set `API_BASE_URL` to your local API URL, for example `http://localhost:10000`.
5. Run the backend:

   ```bash
   cd backend
   npm install
   npm start
   ```

6. Serve `frontend/` locally (for example `python -m http.server 5500 --directory frontend`) and open `http://localhost:5500`.

The API applies `backend/src/schema.sql` idempotently at startup.

## Required Render environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled PostgreSQL connection string |
| `API_PUBLIC_URL` | Full Render API base URL, without trailing slash |
| `FRONTEND_URL` | Published GitHub Pages dashboard URL, without trailing slash |
| `SESSION_SECRET` | At least 32 random characters |
| `APP_ENCRYPTION_KEY` | 64 hex characters (32 bytes) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App credentials |
| `MONITOR_SECRET` | Long random secret shared with the scheduled workflow |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth credentials |

Generate secure secrets locally with:

```bash
openssl rand -hex 32
```

Use one generated value for `APP_ENCRYPTION_KEY`; use a different random value for `SESSION_SECRET` and `MONITOR_SECRET`.

### GitHub OAuth

In GitHub → Settings → Developer settings → OAuth Apps, create an OAuth App. Set the callback URL to:

`https://YOUR-RENDER-SERVICE.onrender.com/api/auth/github/callback`

The current implementation requests `read:user` only. Repository discovery is restricted to public repositories. WebControl reads the `has_pages` and `homepage` fields from the repository list response and does not make a separate per-repository Pages API call. It therefore avoids the unauthenticated REST API rate limit and does not need the broad `repo` OAuth scope. When a repository has a custom Pages domain, set that URL as the repository website/homepage so WebControl can import it; otherwise, WebControl derives the standard `owner.github.io/repository` URL. Private repository discovery is not enabled in this release; it should be added with a GitHub App using narrowly scoped read-only permissions, not a broad `repo` OAuth scope.

### Google OAuth (optional)

Use the Google Cloud project that owns WebControl's OAuth client. In Google Auth Platform, configure the app name, support email and developer contact. Select **External** for a normal Google account, then add your Google account under **Test users** while the app is in testing.

Create an OAuth client with application type **Web application** and use this exact authorized redirect URI:

`https://webcontrol-api.onrender.com/api/integrations/google/callback`

Optional authorized JavaScript origin:

`https://echoairgroup.github.io`

Enable these APIs in the same Google Cloud project:

- Google Analytics Admin API
- Google Analytics Data API
- Google Search Console API

The app requests read-only access only: `analytics.readonly` and `webmasters.readonly`, plus OpenID/email/profile for account identification. The OAuth state is signed by the API and expires after 10 minutes.

Add the resulting `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the Render service environment. Do not commit or publish the secret. The Google account that authorizes WebControl must already have access to the relevant GA4 properties and Search Console properties. After connecting Google in WebControl, map a GA4 property ID and/or Search Console site URL to a monitored website and run a sync.

## Publish on GitHub Pages

1. Create a new repository named `WebControl` under your GitHub account and upload this project to its `main` branch.
2. In repository Settings → Pages, set the source to **GitHub Actions** if it is not enabled automatically by the workflow.
3. Edit `frontend/config.js` and set `API_BASE_URL` to the Render API URL.
4. Push the change. The workflow `.github/workflows/pages.yml` publishes the contents of `frontend/`.
5. Set the final published URL as `FRONTEND_URL` in Render, and make sure it matches the GitHub OAuth callback flow's destination.

Expected project URL for the `echoairgroup` owner: `https://echoairgroup.github.io/webcontrol/`.

## Render deployment

Use the included `render.yaml` as a Blueprint. Select the `webcontrol-api` service, choose the Frankfurt region and supply the required environment variables when prompted. The free plan may spin down after inactivity; consider an always-on plan if you need consistently low-latency API access.

## Scheduled uptime checks

After deploying the API, open repository Settings → Secrets and variables → Actions and add:

- `WEBCONTROL_API_URL` = `https://YOUR-RENDER-SERVICE.onrender.com`
- `WEBCONTROL_MONITOR_SECRET` = the same value as the Render `MONITOR_SECRET`

The included workflow runs approximately every 10 minutes and can also be started manually. GitHub may delay scheduled workflow starts during high load.

## Tracker installation

After importing a GitHub Pages site, open its WebControl management panel and copy the generated tracker snippet. Add it near the end of the website's HTML before `</body>`.

The tracker is consent-gated. After your own consent UI has obtained the required permission, call:

```js
window.webcontrol('consent', 'grant');
```

To revoke permission:

```js
window.webcontrol('consent', 'revoke');
```

To record a conversion:

```js
window.webcontrol('event', 'signup_completed', { plan: 'starter' });
```

Do not send names, email addresses, phone numbers, user IDs, access tokens, form contents or other personal data as event properties.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API + database health |
| GET | `/api/auth/github` | Start GitHub OAuth |
| GET | `/api/auth/me` | Current signed-in user |
| POST | `/api/sites/import` | Discover and import GitHub Pages sites |
| GET | `/api/sites` | List monitored websites |
| POST | `/api/sites` | Add a custom website |
| POST | `/api/collect` | Receive consented tracking events |
| GET | `/api/analytics/overview` | Aggregated statistics |
| GET | `/api/analytics/series` | Time series |
| GET | `/api/analytics/pages` | Top pages |
| GET | `/api/analytics/sources` | Traffic sources |
| GET | `/api/analytics/realtime` | Recent page views |
| GET | `/api/analytics/errors` | Client errors |
| GET | `/api/analytics/technology` | Browser and operating-system breakdown |
| POST | `/api/uptime/check-all` | Scheduled uptime checks |
| GET | `/api/reports/events.csv` | CSV export |

## Release checklist

- [ ] Create the new GitHub repository and push this project.
- [ ] Configure GitHub Pages deployment source.
- [ ] Deploy the API on Render and set all required secrets.
- [ ] Confirm `/api/health` returns `status: ok` and `database: connected`.
- [ ] Configure the GitHub OAuth App and sign in.
- [ ] Import GitHub Pages repositories and confirm their URLs.
- [ ] Install the tracker on each website after reviewing local privacy/consent requirements.
- [ ] Configure GitHub Actions monitoring secrets and run the workflow once manually.
- [ ] Optionally configure Google OAuth and map GA4 / Search Console properties.
- [ ] Test CSV export, tracker collection, key rotation, website removal and scheduled uptime checks.

## License

MIT — see `LICENSE`.
