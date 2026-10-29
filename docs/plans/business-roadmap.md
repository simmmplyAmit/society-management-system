# Business roadmap: ₹5 lakh MRR

Goal: ₹5,00,000 monthly recurring revenue from small and mid-size Indian housing societies
(20–150 flats) that run on registers and Excel today, **without a dedicated support team**.
Written 2026-10-29. Figures are planning estimates, not quotes; revisit them each quarter.

## 1. What the target means

Average society: about 60 flats.

| Average price | Flats needed | Societies (60 flats) |
|---|---|---|
| ₹8 / flat / month | 62,500 | ~1,040 |
| ₹10 / flat / month | 50,000 | ~830 |
| ₹12 base + add-ons (≈ ₹15 / flat) | 33,000 | **~550** |

Maharashtra alone has over a lakh registered co-operative housing societies, so 550–800
customers is under 1% of one state. Market size is not the constraint; cheap acquisition and
keeping societies through committee changes are.

Running cost at that scale (estimate): SMS/WhatsApp ₹30–40k, hosting ₹10–20k, tools ~₹10k a
month, so gross margin around 85%.

## 2. Pricing

1. **Minimum per society** (for example ₹499/month). A 20-flat society at ₹10/flat is ₹200,
   which does not pay for acquiring it.
2. **Annual plan with two months free.** Cash up front, and it carries the society past its
   AGM, when committees change and cancel.
3. **Add-ons** to move from ≈ ₹10 to ≈ ₹15 per flat: gate management (+₹5/flat, later),
   accounting/audit pack (₹3–5k a year), one-time paid data migration.
4. **Small free tier** (for example dues tracking with email-only reminders up to 20 flats)
   for word of mouth without SMS cost.

## 3. Roadmap

### Phase 0 — launch ready (months 0–3, ₹0, 10 pilot societies)
Remove every reason a society would need to contact us:
- [x] Public website and policies (`(marketing)` route group).
- [ ] **Import wizard**: society details, flats with wings/floors, residents, maintenance
      history and arrears, past expenses from Excel/CSV (in progress, `/dashboard/import`).
- [ ] Self-serve signup + trial, and billing for our own subscription (Razorpay subscriptions).
- [ ] Invite links for residents (WhatsApp share), mobile-only sign-in option.
- [ ] Self-service corrections with a second approver: void a cash receipt, credit
      adjustment, reverse wrongly raised dues, edit a charge (see `docs/PENDING.md`).
- [ ] Committee handover (change roles, transfer admin) and recovery when the only admin is lost.
- [ ] Excel/PDF exports for auditors.
- [ ] Error monitoring (Sentry), shared rate limiting (Upstash).

**Exit test:** 10 societies run two billing cycles with under one support contact per society
per month.

### Phase 1 — ₹50k MRR (months 3–9, ~60 societies)
- Start charging; referral offer (one free month for both societies).
- WhatsApp messages (reminders, receipts, notices).
- Marathi and Hindi UI, plus the launch city's language.
- Accountant (CA) partner pilot with 3–5 CAs.

### Phase 2 — ₹2 lakh MRR (months 9–18, ~220 societies)
- Statutory accounting: I and J registers, income & expenditure statement, balance sheet,
  interest on late dues.
- Automatic payment matching: bank statement import (`docs/plans/bank-reconciliation.md`) or
  a gateway that settles into each society's own account (Razorpay Route).
- Accountant portal: one login across all the societies a CA handles.
- Polls / AGM voting, facility booking.

### Phase 3 — ₹5 lakh MRR (months 18–30, 550–800 societies)
- Gate management add-on: guard app, visitor log, deliveries.
- Second and third city/state.
- Optionally move up to 150–300 flat societies (about three times the revenue per society).

## 4. Acquisition without a sales team

1. **Chartered accountants and society auditors** (main channel). One CA audits 20–100 small
   societies. Free multi-society login plus 15–20% revenue share. 25 active CAs bringing 1–2
   societies a month each covers the target.
2. **Housing federations and RWA associations** (district housing federations in Maharashtra,
   RWA federations in Delhi and Bangalore): talks and newsletters reach hundreds of committees.
3. **Referrals inside societies:** committee members know other committees.
4. **Search and free tools** in English and regional languages: maintenance bill generator,
   I & J register template, "society maintenance Excel" template, each leading to the app.
5. **Small builders and property managers:** first year bundled at handover; managers move
   10–30 buildings at once.

Funnel target: 150 sign-ups/month → 25% activate → 80% pay ≈ 30 new paying societies a month.

## 5. Metrics (monthly)

| Metric | Target |
|---|---|
| Support contacts per 100 societies | **< 10** (the "no support team" measure) |
| Days from signup to first dues raised | < 3 |
| Share of dues paid through the app | > 70% |
| Societies lost per month | < 2% (watch around AGMs) |
| Cost to acquire a society | < ₹3,000 (payback under 4 months) |
| Revenue per society | ≥ ₹900 |

## 6. People

- Up to ~200 societies: founder plus part-time onboarding / CA-channel help.
- 500+: one onboarding/success person and one developer. At 600 societies and 5% contacting
  us monthly, that is ~30 contacts a month.

## 7. Risks

- **Free offers from large players** (MyGate, NoBrokerHood): compete on controls against fund
  misuse, accounting depth and the CA channel, not price.
- **Committee turnover:** annual plans, admin handover and resident habit reduce churn.
- **Message costs:** cap reminders; prefer WhatsApp and push over SMS.
- **Handling money:** any gateway must settle directly into the society's account so we stay
  outside RBI payment-aggregator rules (`docs/PENDING.md` §4).

Realistic timeline: 24–30 months bootstrapped, set mostly by how fast the CA channel grows;
15–18 months with a sales co-founder or a seed round.
