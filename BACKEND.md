# CampusCare secure backend

CampusCare now includes a **dependency-free Node.js API** built on Node 24's `node:sqlite` database and authenticated ticket access.

## Local setup

1. Install Node.js **24 or newer**.
2. Generate a key (keep it safe):
   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```
3. Set `DATA_ENCRYPTION_KEY` as an environment variable, e.g. on PowerShell:
   ```powershell
   $env:DATA_ENCRYPTION_KEY = '<paste generated key>'
   npm start
   ```
   Or on Linux/macOS: `DATA_ENCRYPTION_KEY='<your-key>' npm start`.
4. Open **http://127.0.0.1:3000/** (NOT GitHub Pages). This server serves both the UI and `/api`.
5. Run `npm test` to verify key protection, request validation, encrypted CRUD, origins, API headers and throttling.

`.env.example` is a template; Node does **not** automatically load it. Set real environment variables with your host's secrets manager, a shell or a properly protected environment loader. Never publish `.env`, `DATA_ENCRYPTION_KEY` or database files.

## API

- `GET /api/health` checks API availability; it is not a live university status feed.
- `POST /api/requests` creates a ticket with `fullName`, `studentId`, `email`, `category`, `priority`, `subject`, `description`, and `consent:true`. Returns a cryptographically random reference and a **one-time disclosed private access token**.
- `GET /api/requests/:reference` requires `X-Ticket-Key: <private token>`.
- `DELETE /api/requests/:reference` requires the same token and permanently deletes the record.
- No public ticket listing endpoint or administrator account exists.

The server stores AES-256-GCM encrypted student details with a separate random IV and integrity tag for every ticket. Its SQLite records contain only the reference, hash of the secret access token, encrypted payload, IV, tag and creation timestamp. Input is allowlisted, length limited and checked server-side; SQL uses parameterized statements. Responses include CSP, anti-clickjacking and anti-sniffing headers. Requests are capped at 8 KiB, and API calls have per-IP rate limits. The browser remembers **reference and token only** in `sessionStorage`, which is cleared after the tab session; users must save the token themselves to restore access later.

## Deploy securely

- **GitHub Pages remains a static localStorage demo; it cannot execute the Node server.** To use the backend, deploy the Node service with persistent disk storage and open its own origin. Do not point a public site to an unconfigured `http://` API.
- Use a TLS-terminating reverse proxy (e.g. Caddy or nginx) and set `PUBLIC_ORIGIN` to the exact `https://` origin without a trailing slash. Terminate TLS at the proxy and expose the Node service only privately. HSTS is sent when `PUBLIC_ORIGIN` uses HTTPS.
- Use a persistent and access-controlled database path. **Back up both the database and encryption key**; losing the key permanently loses access to encrypted data. SQLite WAL files may exist beside the main database.
- Run Node under an unprivileged account with a restrictive filesystem and process restarts. Keep Node, your OS and proxy patched.
- No authentication is required to **submit** a ticket. Access to individual tickets requires the private token. This is a *capability-token model*, not university student SSO or staff/admin authorization. Add university SSO, role-based permissions and an audit log before any institutional deployment.
- Per-IP rate limiting is in-memory and counts the direct socket address; the server intentionally ignores spoofable `X-Forwarded-For`. For multiple backend instances or proxy deployments, use **proxy/edge rate limiting** with a properly trusted client-IP configuration and shared counters.
- Add retention/automatic deletion, backups, key rotation and incident-response procedures before accepting real personal data. The app does not email ticket keys; losing a key means losing access to the ticket.

## Security regression checks

`npm test` covers unauthenticated reads, forged access tokens, malformed payloads, cross-origin writes, oversize bodies, disallowed routes and rate limiting. Tests run using disposable SQLite databases. The GitHub Actions workflow runs these checks on Node 24 after push/PR.
