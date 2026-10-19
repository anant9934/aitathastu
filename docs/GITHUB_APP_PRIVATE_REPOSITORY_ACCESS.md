# GitHub App Private Repository Access — Implementation Notes

## What this branch adds

- A separate GitHub App installation flow. Existing GitHub OAuth continues to request only `read:user`; it does not request the broad `repo` OAuth scope.
- Installation state validation through an HttpOnly, SameSite=Lax cookie and the signed-in student's server session.
- Installation ID and permission metadata persisted on the student's existing GitHub connection. No installation access token is persisted.
- Short-lived installation tokens created server-side for each private sync.
- Repository enumeration through the installation's accessible repository list, followed by batched GraphQL reads of language metadata, README, and supported dependency manifests.
- Private repository snapshots, project candidates and technology evidence stored with `isPrivate` and `accessMethod: github_app_installation` metadata.
- Student UI actions to authorize selected repositories and sync them.

## Required GitHub App configuration

Create or configure a GitHub App owned by the operator:

1. Set **Setup URL** to `https://YOUR_APP_ORIGIN/api/auth/github/app-callback`.
2. Grant **Repository permissions**: **Metadata: Read-only**, **Contents: Read-only**. Do not grant write permissions.
3. Configure the App to let the installing user select repositories. The user chooses the repository set on GitHub's installation screen.
4. Add server-side environment variables:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_SLUG`
   - `GITHUB_APP_PRIVATE_KEY` (PEM private key; never expose it to client code)
5. Deploy the branch and set those variables in every environment that should support this feature.

## User flow

1. Sign in to AI Tathastu and open **Connections → GitHub → Manage**.
2. Choose **Authorize selected repositories**.
3. On GitHub, install/update the App and select the repositories to grant access to.
4. Return to AI Tathastu and choose **Sync authorized repositories**.

## Security boundaries

- Access is limited to repositories available to the GitHub App installation and the permissions granted by that installation.
- Installation tokens are short-lived and are generated on the server per sync.
- Existing OAuth continues to use `read:user`; private access is not enabled by adding `repo` to OAuth scopes.
- Only repository metadata and contents are requested. The feature does not write commits or execute repository code.
- Imported technology findings remain unverified and should not be presented as proof of personal proficiency.
- Uninstall the GitHub App from GitHub settings to revoke provider-side access. Disconnecting AI Tathastu prevents its local sync route from using the saved installation ID but is not a substitute for uninstalling the App.

## Verification status

This branch was created through the GitHub API; no local checkout, TypeScript build, browser run, or live GitHub App installation test was available in this execution. The App configuration and environment variables must be supplied before end-to-end private-repository access can work. Run `npm run typecheck`, `npm run lint`, `npm run build`, and the existing GitHub verification scripts before merging. Check that a test installation can read a selected private repository and cannot read an unselected repository.
