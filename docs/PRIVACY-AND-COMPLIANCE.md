# Privacy and compliance notes

Working notes for the people running the service. **This is not legal advice.** Have a lawyer who knows India's Digital Personal Data Protection Act, 2023 (DPDP Act) and the Rules in force review the Privacy Notice (`/privacy`), the consent wording and the retention periods before you sign up paying societies.

## 1. What the app does today

| Need | How it is handled |
|---|---|
| Tell people what is collected and why | Public **Privacy Notice** at `/privacy` (`src/app/privacy/page.tsx`), linked from sign-in and the consent screen. |
| Get and prove consent | Everyone except the platform super-admin must tick *"I have read the Privacy Notice and I agree…"* on `/consent` before using the app. The dashboard layout enforces it on every page. Each agreement is kept in the append-only `ConsentRecord` table (who, which version, when) and on the user (`privacyVersion`). |
| Re-ask after changes | Bump `PRIVACY_VERSION` in `src/lib/privacy.ts` (and the date). Everyone is sent to `/consent` again on their next visit. |
| Copy of your data | **Privacy & my data** (`/dashboard/privacy`) → *Download my data* (`GET /api/me/export`, JSON, only the caller's own data). |
| Correction / erasure | Same page → *Correct or erase my data* creates a `DataRequest`. An **admin other than the requester** handles it: mark corrected, decline with a reason, or *Erase account*. |
| Erasure behaviour | `anonymiseUser`: name, email, phone, avatar and sign-in are removed and the account closed; their community posts/comments, OTP codes and linked sign-in accounts are deleted; the addresses in message logs are blanked. **Financial records (dues, payments, credit ledger, receipts, expenses, tax documents) are kept, without the person's identity** because societies must keep accounts. Blocked while the member holds credit or has payment reports awaiting review. |
| Security | HTTPS, provider encryption at rest, field-level encryption of phone numbers and UPI IDs (see CLAUDE.md, "Field-level encryption"), hashed passwords, per-society isolation, role checks, four-eyes on UPI changes. |

## 2. Fill in before launch

Set these environment variables (Vercel → Production) so the notice names a real contact:

```
PRIVACY_OPERATOR_NAME=<legal name of the company or person running Society MS>
PRIVACY_CONTACT_EMAIL=<mailbox that is read, for requests and complaints>
PRIVACY_GRIEVANCE_OFFICER=<name of the person who answers grievances>
PRIVACY_POSTAL_ADDRESS=<registered address, optional>
```

Without them the notice says "the Society MS team" and "your society committee", which is not a usable grievance route.

## 3. Data inventory

| Data | Where | Who can see it | Encrypted in the app | Kept |
|---|---|---|---|---|
| Name, email, role | `User` | Committee; names also on posts | No (email is the login key) | While linked; anonymised on erasure |
| Phone number | `User.phone` | Committee | **Yes** | Same |
| Society UPI ID, UPI change history | `Society`, `UpiChangeRequest` | Admin/treasurer; residents see the current UPI ID when paying | **Yes** | While the society is a customer |
| Flats and residency | `Flat`, `FlatResident` | Committee; resident sees own | No | History kept |
| Dues, payments, UTRs, credit ledger, cash receipts | various | Committee; resident sees own | No | **8 years** (accounts) |
| Payment proof screenshots, complaint photos | R2 files | Committee + uploader | Provider-level | Until deleted; removed 30 days after deletion |
| Complaints | `Complaint*` | Resident + committee | No | Kept as society record; identity removed on erasure |
| Community posts | `Post*` | All residents | No | Until deleted or erasure |
| Documents | R2 + `Document` | Per file (committee or all residents) | Provider-level | Tax/audit 8 years; others until deleted |
| Message delivery logs | `NotificationLog` | Not shown in the app | No | Recipient address blanked on erasure |
| Sign-in sessions | cookie (JWT) | n/a | Signed + encrypted | Until sign-out/expiry |

## 4. Processors (list them in the Privacy Notice and keep contracts)

Vercel (hosting), Neon (database), Cloudflare R2 (files), Resend (email), MSG91 (SMS). Check each provider's data-processing terms and where data is stored (Neon region, R2 location hint). If you add a provider (WhatsApp, a payment gateway) update the notice and bump `PRIVACY_VERSION`.

## 5. Handling requests

- **Target:** answer access, correction and erasure requests within **15 days** (this is the figure promised in the notice; keep it or change both).
- Requests appear to admins under **Privacy & my data → Requests from residents**. An admin cannot handle their own request: ask another admin, or the platform team if the society has only one.
- Before erasing someone who is leaving, close their tenancy/ownership link and settle any credit.
- Keep the resolution note: it is the record that you responded.

## 6. Not automated yet (decide and document)

- **Retention enforcement:** nothing deletes 8-year-old financial records or inactive accounts automatically.
- **Consent withdrawal** is done by asking for erasure; there is no separate "withdraw" button.
- **Children/guardians:** no age check.
- **Society-level agreements:** the platform acts for each society. Put a short data-processing agreement in your customer terms.
- **Terms of Service** do not exist yet.
- **Cookie banner:** not needed while only the essential sign-in cookie is used.
- **Audit log of who viewed personal data** is not kept.
- Incident handling: see `docs/SECURITY-INCIDENT-RESPONSE.md`.

## 7. Questions for the lawyer

1. Is the platform operator a data fiduciary or a processor for each society, and does the notice describe that correctly?
2. Are 8 years (financial records) and 15 days (response time) right?
3. What must the breach report to the Data Protection Board and to affected people contain, and by when under the Rules currently in force?
4. Is the consent wording sufficient, and do you need separate consent for SMS/email notices or for sharing with processors outside India?
5. Is anonymising a profile while keeping financial records enough to satisfy an erasure request?
