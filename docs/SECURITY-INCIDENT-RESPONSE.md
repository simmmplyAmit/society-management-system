# Security incident response

For a suspected leak, break-in or loss of data. **Stay calm, write everything down with times, and do the steps in order.** Not legal advice: confirm notification duties with a lawyer (see `docs/PRIVACY-AND-COMPLIANCE.md`).

## 1. Signs that should start this process

- Someone reports seeing another society's or another resident's data.
- A secret was exposed: committed to Git, pasted in chat or email, shown in a screenshot or a log.
- A Vercel, Neon, Cloudflare, GitHub, Resend or MSG91 account was accessed by someone unexpected, or a laptop with access was lost.
- Unexpected sign-ins, UPI ID change requests nobody made, unusual emails/SMS sent, or unexplained changes to dues and payments.
- A provider tells you about an incident on their side.

## 2. First hour: contain

1. Name one person in charge and note the time you learned of it.
2. **Rotate what may be exposed** (what to change is in section 4). When unsure, rotate more rather than less.
3. If a society's UPI ID may have been changed, check **Payment settings** in that society and tell its committee in person or by phone to confirm the ID; reject any request they did not make.
4. Do not delete logs or data: you need them to understand what happened. Take screenshots and save Vercel/Neon logs.
5. If an account is compromised, deactivate that user (**Residents → deactivate**) and reset their password.

## 3. Find out what happened

Answer, and keep the answers in a document:
- What data (which tables or files), whose, and how many people or societies?
- Could it be read, copied, changed or deleted? Since when until when?
- How did it happen, and is it fixed?
- Is data that is **encrypted** involved? Phone numbers and UPI IDs are encrypted in the database with `FIELD_ENCRYPTION_KEY`: if only the database leaked and the key did not, those columns are unreadable. If the key leaked too, treat them as exposed.
- Check Neon query logs/history, Vercel logs, R2 access logs, GitHub audit log, and `ConsentRecord`/`NotificationLog` for unusual activity.

## 4. What to rotate

| Exposed | Do this | Effect |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` (Neon) | Neon console → reset the role's password, update both variables in Vercel, redeploy | Brief outage until redeploy |
| `AUTH_SECRET` | Generate a new one (`openssl rand -base64 32`), update in Vercel, redeploy | **Everyone is signed out**; OTP codes issued earlier stop working too |
| `CRON_SECRET` | New value in Vercel; Vercel cron uses it automatically | None |
| R2 token | Cloudflare → revoke the token, create a new Object Read & Write token for the bucket, update `R2_*` in Vercel | Uploads fail until updated |
| Resend / MSG91 keys | Revoke and create new in each console, update in Vercel | Messages fail until updated |
| GitHub / Vercel / Neon / Cloudflare account | Change password, turn on two-step sign-in, remove unknown sessions, tokens and members | |
| `FIELD_ENCRYPTION_KEY` | Create a new key; set it as `FIELD_ENCRYPTION_KEY` and move the old one to `FIELD_ENCRYPTION_KEY_PREVIOUS`; deploy; run `npm run encrypt-fields` (with a direct DB URL) until it says "Nothing left to do"; then remove the previous key. **If the old key was leaked, the old ciphertext in any stolen database copy is still readable with it**: rotating protects future data only | Keep both keys safe until the script finishes |

## 5. Tell people

- **Residents/societies affected:** say what happened, which of their data, what you did, what they should do (for example, watch for fake payment messages, confirm the UPI ID), and how to reach you. Use plain language and do not blame.
- **The authorities:** the DPDP Act requires telling the Data Protection Board of India and each affected person about a personal data breach. The Rules published so far require this **without delay**, with a detailed report to the Board within **72 hours**. Confirm the current timeline and format with your lawyer on day one and keep the clock in mind from the moment you became aware.
- **Providers:** report it to the affected provider if the problem is on their side.
- Keep copies of everything you send.

### Message template

> Subject: Security notice about your [Society name] account
>
> On [date] we found that [what happened]. This affected [which data] of [who]. [It did / did not include passwords, payment details, uploaded files.]
> What we have done: [contained, rotated, fixed].
> What you should do: [for example: if you receive a payment request, confirm the UPI ID with the committee in person; change your password].
> Questions: [contact]. We are sorry this happened.

## 6. After

- Write a short report: timeline, cause, impact, what was done, what changes (a missing check, an exposed token, a gap in monitoring).
- Make the fixes, add a test where the code was at fault, and update this document.
- Practise: once a year, rehearse a key rotation and a restore from a Neon backup.
