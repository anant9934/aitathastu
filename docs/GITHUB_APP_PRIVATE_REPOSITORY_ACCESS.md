# GitHub App Private Repository Access — Implementation & Verification Guide

## 1. Overview & Architecture

AI Tathastu enables students to securely connect their GitHub account and optionally grant access to selected private repositories. The implementation follows the principle of least privilege:

1. **Identity & Public Access via OAuth:** The standard GitHub OAuth integration requests strictly the `read:user` scope. It does NOT request the broad, dangerous `repo` OAuth scope.
2. **Selected Private Repository Access via GitHub App:** Access to private repositories is granted only when the student explicitly installs an operator-configured GitHub App and chooses specific repositories on GitHub's installation screen.
3. **Short-Lived Installation Tokens:** No permanent access token or installation token is persisted in the database. During each sync, a short-lived token valid for up to 10 minutes is generated server-side using the App's private key (RS256 JWT) and immediately discarded after extraction.
4. **Read-Only Scope:** The GitHub App requests exclusively:
   - **Repository Metadata:** Read-only (`metadata: read`)
   - **Repository Contents:** Read-only (`contents: read`)
   - Write permissions and code execution permissions are never requested or granted.

---

## 2. Security & Cryptographic Invariants

- **Person-Bound State Token (CSRF Protection):** The authorization state token is generated as an HMAC-SHA256 signed payload containing `personId`, `timestamp`, and a 24-byte cryptographic nonce: `${Buffer.from(payload).toString('base64url')}.${signature}`. During the callback, the server verifies the signature, enforces that `personId` matches the authenticated session, and rejects tokens older than 10 minutes.
- **Account Mismatch Protection:** The callback enforces that the GitHub App installation account matches the student's connected GitHub account (`installation.account.login === connection.externalUsername`). This prevents cross-account attachment attacks.
- **Least-Privilege Permission Check:** The callback strictly validates that both `contents: "read"` and `metadata: "read"` are granted. If permissions are missing or the app is suspended, the callback aborts cleanly.
- **Untrusted Input Sanitization:** Private repository README files, commit messages, and source files are treated as untrusted data. HTML tags (`<script>`, `<iframe>`) are neutralized, and prompt-injection phrasing (`SYSTEM OVERRIDE`, `ignore previous instructions`) is stripped before content enters analysis.
- **Unverified Skill Attribution:** Discovered technologies are tagged with provenance (`manifest_declared`, `configuration_observed`, `source_imported`) and marked as `unverified` evidence. They are never automatically asserted as confirmed personal skills.
- **Zero Secret / Token Leakage Guarantee:** Installation access tokens and the App's private key are strictly excluded from API responses, client bundles, database snapshots, and application logs.

---

## 3. Required GitHub App Configuration

To configure the GitHub App in GitHub Developer Settings:

1. **GitHub App Name:** `AI Tathastu Candidate Reader` (or organizational equivalent).
2. **Homepage URL:** `https://www.aitathastu.com` (or deployment origin).
3. **Setup URL:** `https://YOUR_APP_ORIGIN/api/auth/github/app-callback`.
   - GitHub redirects to this URL after the student installs the app and chooses repositories.
4. **Repository Permissions:**
   - **Repository metadata:** Read-only
   - **Repository contents:** Read-only
   - All other permissions must be set to "No access".
5. **Where can this GitHub App be installed?:**
   - Select: **Any account** (to allow students to install it on their personal accounts).
6. **Generate Private Key:** Download the `.pem` file and copy its content to `GITHUB_APP_PRIVATE_KEY`.

### Server Environment Variables:

Add to `.env` or Vercel Environment Variables:
```env
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=ai-tathastu-candidate-reader
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
```
*Note: Literal `\n` characters in `GITHUB_APP_PRIVATE_KEY` are automatically normalized into multiline PEM strings.*

---

## 4. Endpoints & Data Model

### Endpoints:
- `GET /api/auth/github/app-start`: Initiates the authorization flow, mints signed state token, sets `tathastu_gh_app_state` HttpOnly cookie, and redirects to GitHub.
- `GET /api/auth/github/app-callback`: Validates state signature, session binding, permissions, and account match. Persists installation metadata and redirects to `/student/connections`.
- `GET /api/student/connections/github/private-sync`: Returns real-time private connection status, installation ID, account login, repository counts, and last sync timestamp.
- `POST /api/student/connections/github/private-sync`: Executes on-demand synchronization of authorized private repositories. Returns explicit `GitHubAppSyncSummary`.
- `DELETE /api/student/connections?provider=github`: Revokes OAuth tokens, deletes GitHub App installation via GitHub API (`DELETE /app/installations/:id`), and cleans up local metadata.

### Explicit Sync Status Model:
`GitHubAppSyncStatus`:
- `COMPLETED`: 100% of discovered authorized repositories were processed successfully.
- `PARTIAL`: Some repositories succeeded, but one or more encountered read errors. `success: false`, HTTP 207 Multi-Status.
- `NOT_AUTHORIZED`: GitHub App is not installed or the session is unauthorized. HTTP 403.
- `RATE_LIMITED`: GitHub API rate limit was encountered. HTTP 429.
- `FAILED`: Critical failure during sync. HTTP 400 or 500.

---

## 5. Manual End-to-End Verification Steps

1. Sign in to AI Tathastu as a student.
2. Navigate to **Connections → GitHub → Manage**.
3. Under **Private repository access**, click **Authorize selected repositories**.
4. On GitHub's installation screen, select **Only select repositories**, choose 1 private test repository (e.g. `my-private-project`), and click **Install & Authorize**.
5. You are redirected back to AI Tathastu with `?success=github_app_installed`.
6. The drawer displays:
   - Green chip: `GitHub App Active`
   - Connected account name
   - Authorized repositories: `1 private · 0 public (1 total)`
7. Click **Sync authorized repositories**.
8. Verify that the repository appears in your **Projects Ledger** and **GitHub Intelligence Dashboard** marked with `private: true` and `accessMethod: github_app_installation`.
9. Verify that another private repository that was NOT selected on GitHub cannot be read or seen.
10. Click **Disconnect** in the connection drawer. Verify that the installation ID is erased and local status returns to disconnected while already imported project history is preserved.

---

## 6. Automated Regression & Unit Test Coverage

Run the private authentication test suite:
```bash
npm run test:github-private-auth
```
Tests pass across:
- App JWT RS256 token generation and expiration.
- Person-bound state token generation, signature validation, tampering, and expiration.
- Least-privilege permission validation.
- Repository visibility categorization.
- Prompt injection defenses on untrusted READMEs.
- Database persistence and idempotent deduplication across repeated syncs.
- Multi-tenant candidate boundary isolation.
- Explicit status enum representations (`COMPLETED`, `PARTIAL`, `FAILED`, `NOT_AUTHORIZED`).
- Disconnect lifecycle and credential erasure.
- Zero secret and token leakage verification.

