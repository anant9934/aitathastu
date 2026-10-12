# AI TATHASTU — NETLIFY PRODUCTION CUTOVER AND ROLLBACK PLAN

## Pre-Conditions for Cutover Authorization

ALL of the following must be verified on Netlify Preview before cutover:

- [ ] Gate A: Next.js 15 deploys correctly on Netlify
- [ ] Gate B: Student signup, login, onboarding work on Netlify Preview
- [ ] Gate C: Neon connectivity confirmed from Netlify functions
- [ ] Gate D: Native PDF extraction works
- [ ] Gate E: OCR-required PDF (vector-outline) processed successfully on Netlify
- [ ] Gate F: GitHub Digital Footprint works
- [ ] Gate G: Student Dashboard, Person 360, Skills, Evidence, EORA work
- [ ] Gate H: No exposed secrets; secure file storage confirmed
- [ ] Gate I: Desktop E2E tests pass (1280x800, 1440x900, 1920x1080)
- [ ] USER explicit authorization for production DNS change

## Cutover Steps (In Order)

### Step 1: Final pre-cutover checks
```
1. Confirm Neon production database backup/recovery plan is current
2. Confirm all production secrets are valid and rotated if previously exposed
3. Confirm final Netlify production build is deployed and verified
4. Confirm APP_BASE_URL is set to production domain (www.aitathastu.com)
```

### Step 2: Update OAuth Redirect URIs
```
Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client:
  Add: https://www.aitathastu.com/api/auth/google/callback
  Add: https://www.aitathastu.com/api/auth/github/callback
  Remove (after verification): old Vercel domain callbacks
```

### Step 3: Configure Netlify Production Domain
```
Netlify Dashboard → Site Settings → Domain Management:
  Add custom domain: www.aitathastu.com
  Enable Netlify automatic HTTPS (Let's Encrypt)
  Configure DNS CNAME/A record at domain registrar
```

### Step 4: DNS Cutover
```
Update DNS:
  CNAME www → [netlify-site].netlify.app
  Wait for propagation (up to 48 hours for full global propagation)
  Verify: curl -I https://www.aitathastu.com
```

### Step 5: Post-Cutover Verification
```
1. New student signup → onboarding → dashboard
2. Existing student login → dashboard (correct data)
3. CV upload → OCR processing → candidate review → Person 360
4. GitHub Digital Footprint connection
5. EORA chat
6. Settings update persistence
7. Browser navigation (back/forward)
8. Session persistence across page refresh
```

### Step 6: Monitor for 24-48 hours
```
- Netlify function error rates
- OCR background function completion rates
- Neon query performance
- Authentication success/failure rates
- Job stuck rate (cron cleanup metric)
```

### Step 7: Retire Previous Infrastructure (ONLY after stable operation + authorization)
```
1. Remove Vercel project from Vercel dashboard
   (Keep for rollback until 7+ days of stable Netlify operation)
2. Shut down Render aitathastu-resume-extractor service
   (Keep until OCR is production-verified on Netlify)
3. Remove Render-specific env vars from configuration
4. Archive render.yaml (do not delete from git history)
```

---

## Rollback Plan

### If Netlify production fails within first 7 days:

```
1. Revert DNS CNAME to Vercel deployment URL
2. Re-enable Vercel project if suspended
3. Re-enable Render service if suspended
4. Preserve Neon database as-is (no data migration happened)
5. Investigate and document the failure
6. Do NOT delete student data or Neon records
7. Record incident with: timestamp, symptoms, root cause, resolution
```

### Database Rollback
- Neon is the canonical database and was NEVER replaced
- Schema migrations were not run during this hosting migration
- No data was moved between database providers
- Rolling back DNS is sufficient to restore student data access

### Avoiding Concurrent Writes During Rollback
- Ensure only ONE application version is active at a time (Vercel OR Netlify, not both)
- If both must be briefly active during DNS propagation:
  - No destructive operations (DELETE, truncate) during overlap window
  - Both versions use the same Neon schema — safe for concurrent reads

---

## Status: NOT STARTED — Awaiting Gate verification
