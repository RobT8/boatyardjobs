# Google Indexing API — keyless setup (Workload Identity Federation)

This wires the daily aggregation cron (GitHub Actions) to the **Google Indexing
API** so listings are pushed to Google for Jobs the moment they go live or come
down — **without storing a service-account key** (our org blocks key creation,
and keyless is Google's recommended approach anyway).

How it works: GitHub Actions mints a short-lived OIDC token for each run; Google
**Workload Identity Federation** trusts that token and lets it impersonate a
service account; the `google-github-actions/auth` step exchanges it for an
Indexing-API-scoped access token that the aggregator uses. Nothing long-lived is
stored — only the (non-secret) provider name and service-account email.

The code is already wired (`src/lib/google-indexing.ts`, `scripts/aggregate/run.ts`,
`.github/workflows/aggregate.yml`) and stays a no-op until the steps below are done.

---

## 1. Run the GCP setup (Cloud Shell — no local install needed)

Open **Cloud Shell** (the `>_` icon, top-right of console.cloud.google.com) and
paste this, editing the first two lines if needed:

```bash
export PROJECT_ID="$(gcloud config get-value project)"   # or set explicitly
export REPO="RobT8/boatyardjobs"                          # owner/repo of the GH repo

export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
export SA_NAME="boatyardjobs-indexing"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Enable the APIs we need (Indexing + the token-exchange APIs)
gcloud services enable indexing.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

# Service account — no key is ever created
gcloud iam service-accounts create "$SA_NAME" --display-name "BoatyardJobs Indexing"

# Workload Identity pool + a provider that trusts GitHub's OIDC issuer,
# locked to this one repository
gcloud iam workload-identity-pools create github \
  --location global --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-actions \
  --location global --workload-identity-pool github \
  --display-name "GitHub Actions" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository == '${REPO}'"

# Allow that repo's OIDC identity to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# Print the two values you'll paste into GitHub
echo
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-actions"
echo "GCP_INDEXING_SERVICE_ACCOUNT=${SA_EMAIL}"
```

Copy the last two printed lines.

## 2. Make the service account a Search Console Owner

In [Search Console](https://search.google.com/search-console) → **boatyardjobs.com**
property → **Settings → Users and permissions → Add user**:

- User = the `SA_EMAIL` printed above (`boatyardjobs-indexing@…iam.gserviceaccount.com`)
- Permission = **Owner** (anything less returns `403`)

The property must already be **verified**. This is what authorizes the API call —
not any GCP IAM role.

## 3. Configure the GitHub repo

Repo → **Settings → Secrets and variables → Actions**:

- **Variables** tab → New repository variable (these aren't sensitive):
  - `GCP_WORKLOAD_IDENTITY_PROVIDER` = the `projects/…/providers/github-actions` value
  - `GCP_INDEXING_SERVICE_ACCOUNT` = the service-account email
- **Secrets** tab → New repository secret:
  - `SITE_URL` = `https://boatyardjobs.com`

## 4. Test

Actions tab → **Aggregate jobs** → **Run workflow**. In the logs look for:

```
Google Indexing: N updated, M removed notified.
```

(If there were no new/expired listings that run, the line is omitted — that's fine.)

---

## 5. (Optional) Vercel real-time events — keyless via Vercel OIDC

Steps 1–4 cover the **cron**. To also ping Google the instant a *direct* job is
published/renewed (Stripe webhook), posted by an admin, or made free with a
100%-off code, give the Vercel runtime its own keyless path. Same service
account, a second WIF provider that trusts Vercel's OIDC issuer.

**a. Enable Vercel OIDC.** Vercel → Project → **Settings → Security → Secure
Backend Access with OIDC Federation** → **Team** issuer mode. Note the token
claims it shows:
- `iss` = `https://oidc.vercel.com/<team-slug>`
- `aud` = `https://vercel.com/<team-slug>`
- `sub` = `owner:<team-slug>:project:<project>:environment:production`

The `<team-slug>` is the middle segment of your Vercel URL (e.g.
`robtait88-4590s-projects`). Match these exactly in the next step.

**b. Add a Vercel provider to the same pool** (Cloud Shell). ⚠️ Run this as the
Google account that **owns the project** — the same one that created the pool in
step 1 (check `gcloud config get-value account`), or you'll get a silent
`PERMISSION_DENIED`. We key the provider off the token's `sub` claim (Vercel does
**not** expose top-level `owner`/`project` claims, so conditioning on those fails):

```bash
export VERCEL_TEAM="your-team-slug"             # e.g. robtait88-4590s-projects
export VERCEL_PROJECT="boatyardjobs"            # Vercel project name

gcloud iam workload-identity-pools providers create-oidc vercel \
  --location global --workload-identity-pool github \
  --display-name "Vercel" \
  --issuer-uri "https://oidc.vercel.com/${VERCEL_TEAM}" \
  --allowed-audiences "https://vercel.com/${VERCEL_TEAM}" \
  --attribute-mapping "google.subject=assertion.sub" \
  --attribute-condition "assertion.sub.startsWith('owner:${VERCEL_TEAM}:project:${VERCEL_PROJECT}:')"

# Let the Vercel *production* identity impersonate the same service account
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role roles/iam.workloadIdentityUser \
  --member "principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/subject/owner:${VERCEL_TEAM}:project:${VERCEL_PROJECT}:environment:production"

echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/vercel"
```

**c. Set Vercel env vars** (Project → Settings → Environment Variables, all
environments — then **redeploy**):

- `GCP_WORKLOAD_IDENTITY_PROVIDER` = the `…/providers/**vercel**` value just printed
- `GCP_INDEXING_SERVICE_ACCOUNT` = the service-account email (same as the cron)
- `SITE_URL` = `https://boatyardjobs.com`

The code reads the OIDC token via `@vercel/functions` (`getVercelOidcToken()`),
**not** `process.env.VERCEL_OIDC_TOKEN` — in production Vercel doesn't expose it
as an env var. Verify with a test post: the runtime log shows
`Google Indexing: notified live <url>`.

That's it — the code reads `VERCEL_OIDC_TOKEN` at runtime, exchanges it with
Google STS, impersonates the service account, and notifies. No key. (`VERCEL_OIDC_TOKEN`
is injected automatically once OIDC is enabled; nothing to set for it.)

> The cron (GitHub) and Vercel use the **same** env-var *names* with **different
> values** — each points at its own provider (`…/providers/github-actions` vs
> `…/providers/vercel`). That's expected.

## Notes & troubleshooting

- **`403 Permission denied` from the publish call** → the service account isn't an
  **Owner** of the Search Console property (or the property isn't verified).
- **Provider creation blocked by an org policy** (`iam.workloadIdentityPoolProviderAllowedIssuers`)
  → the same Secure-by-Default org may restrict OIDC issuers; allow
  `https://token.actions.githubusercontent.com` on that constraint (org scope),
  same place you'd manage the key-creation policy.
- **Quota** — Google grants ~200 publish calls/day by default. The cron only
  notifies on deltas and stops early on a quota error, so it degrades gracefully.
  Request more in the API's *Quotas* page if daily churn outgrows it.
- **Real-time events on Vercel** (a *direct* job published/renewed via Stripe, the
  admin "post for a client" form, the 100%-off path) are covered by **step 5**
  (Vercel OIDC). If you skip step 5 they simply no-op on Vercel — not critical,
  since the cron re-notifies anything still live and direct jobs are low volume.
- **Vercel exchange fails with `invalid_target`/audience errors** → the GCP
  `vercel` provider's `--allowed-audiences` must match Vercel's token audience
  (`https://vercel.com/<team>`); and `--issuer-uri` must be
  `https://oidc.vercel.com/<team>`. Re-check the team slug.
- **`generateAccessToken` returns 403** → the Vercel principal isn't bound with
  `roles/iam.workloadIdentityUser` on the service account (step 5b), or the
  attribute-condition/`attribute.project` binding doesn't match the project.
