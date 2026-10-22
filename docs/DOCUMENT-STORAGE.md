# Document storage (Cloudflare R2) setup

Documents (bills, tax receipts, agreements, minutes…) are stored in a **private** R2 bucket. The app issues short-lived signed links; nothing is ever public. Until the four keys below are set, uploads show a clear "storage isn't set up" message and everything else works.

## 1. Create the bucket

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket** (for example `society-documents`). Pick the **Asia-Pacific** location hint.
2. Leave **public access off**. Do not enable the `r2.dev` URL or a custom public domain.

## 2. Create an API token

R2 → **Manage API tokens** → **Create API token**:
- Permission: **Object Read & Write**
- Scope: **only this bucket**
- Copy the **Access Key ID** and **Secret Access Key** (shown once). Your **Account ID** is on the R2 overview page.

## 3. Allow browser uploads (CORS)

Bucket → **Settings** → **CORS policy** → add (replace the origin with your app URL; add `http://localhost:3000` while testing):

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Downloads are redirects the browser opens directly, so they need no CORS rule.

## 4. Environment variables (Vercel and `.env.local`)

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=society-documents
DOCUMENT_QUOTA_MB=1024        # per society, optional (default 1024)
```

Redeploy after adding them. Then open **Documents** as a committee member and upload a small PDF.

## How it works

1. `requestDocumentUpload` checks the role, type (PDF/JPG/PNG/WebP), size (10 MB) and the society's quota, saves a `PENDING` record and returns a 5-minute signed `PUT` link. The link is tied to the exact content type and size.
2. The browser uploads straight to R2.
3. `confirmDocumentUpload` checks the stored size and the file's first bytes (so a renamed `.exe` or HTML file is rejected and removed), then marks it `READY`.
4. `GET /api/documents/<id>` checks the viewer's society and role (residents only see files marked "All residents"), then redirects to a 60-second signed link.
5. The daily cron deletes uploads never confirmed after 1 hour and removes files 30 days after they were deleted.

Storage keys look like `societies/<societyId>/<documentId>/<random>.<ext>`; the original file name is only stored in the database.

## Retention

Tax receipts and audit records are kept for **8 years** and cannot be deleted before then. Everything else is soft-deleted (restorable by an engineer for 30 days).

## Not covered yet

Virus scanning, image resizing before upload, attaching files to payment reports, renewal reminders for expiring agreements and insurance. See `docs/PENDING.md`.
