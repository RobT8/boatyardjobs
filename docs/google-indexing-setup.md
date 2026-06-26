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
  admin "post for a client" form, the 100%-off path) are **not** covered by this —
  WIF here only authenticates the GitHub cron. Those events currently no-op on
  Vercel. Options if you want them too: set `GOOGLE_INDEXING_ACCESS_TOKEN`/key
  env on Vercel, or add Vercel OIDC federation later. Not critical: the cron
  re-notifies anything still live, and direct jobs are low volume.
