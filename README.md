# Sonicgids Empire — Social Growth Panel & Marketing Website

Official website for **Sonicgids Empire**. The homepage and sign-in / account-recovery pages are
public. Client account pages require a Firebase login and a verified email (Google sign-in counts as
verified); the three configured admin accounts can access the admin console without email verification.
Verified clients can place boost orders using a naira wallet, track orders, and submit manual top-up
requests with a Base64 receipt image for admin approval. There are **no subscriptions and no retainer plans**.

Built as a **plain static site** — HTML, CSS and vanilla JavaScript, no build step and no
dependencies to install. Deploy the folder anywhere; it runs as-is.

**Design system:** a light, minimal UI — white surfaces, one ink colour, one gold accent, flat
1px borders and soft shadows. All tokens live at the top of `assets/css/style.css`; change
`--gold-strong`, `--ink` or `--bg-soft` there and the whole site follows. Styles are split into
`style.css` (tokens, layout, nav, footer, components), `pages.css` (marketing page blocks) and
`admin.css` (dashboard shell, boost panel, rate card, admin console).

---

## Pages

| Page | File | Purpose |
| --- | --- | --- |
| Home | `index.html` | Hero, services, stats, process, proof, **live rate teaser**, FAQ |
| Services overview | `services.html` | All five service lines + supporting work |
| Social Media Management | `service-social.html` | Service detail with deliverables, process, FAQ |
| Paid Advertising | `service-ads.html` | Service detail |
| Content & Creative Studio | `service-content.html` | Service detail |
| SEO & Web | `service-seo.html` | Service detail |
| Influencer Marketing | `service-influencer.html` | Service detail |
| Case Studies | `case-studies.html` | Filterable results by industry |
| **Boost rate card** | `pricing.html` | Login-required, searchable naira rate table (rate per 1,000, min, max, start time) rendered live from the admin catalogue |
| Insights (blog) | `blog.html` | Featured post, category filter, newsletter |
| Articles | `blog-*.html` (6) | Full articles: playbook, Instagram, Meta ads, hooks, metrics, local SEO |
| About | `about.html` | Story, principles, team, timeline |
| FAQ | `faq.html` | Grouped answers with FAQ schema |
| Contact | `contact.html` | Brief form → Firestore, direct contact lines |
| Thank you | `thank-you.html` | Post-submission confirmation |
| **Boost panel** | `order.html` | Signed-in buy page: search plans → category → service → link → quantity → amount (₦) → **Continue** (orders start as **pending**) |
| Sign in | `login.html` | Firebase email/password or Google sign-in |
| Create account | `signup.html` | Firebase account creation; email/password sign-up sends an email verification link |
| Verify email | `verify-email.html` | Resend the verification link and re-check access before opening client pages |
| Reset password | `forgot-password.html` | Password reset email |
| Dashboard | `dashboard.html` | Email-verified app shell with a side menu: **New order** (boost panel), **My orders**, **Wallet** (balance, top-ups, activity) and **Activity** |
| **Admin console** | `admin.html` | **Owner-only.** Process orders, **set the rate per 1,000 / min / max**, priorities and the catalogue |
| 404 | `404.html` | Custom not-found page |
| Legal | `privacy.html`, `terms.html` | Privacy policy and terms of service |

Also included: `sitemap.xml`, `robots.txt`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `tools/`.

---

## The money model (free site, paid boosts)

| Question | Answer |
| --- | --- |
| Does the visitor pay to use the site? | **No.** Account, rate card, ordering and tracking are free. |
| What do they pay for? | Only the boosts they order. |
| How is a price formed? | `amount = quantity ÷ 1,000 × ratePer1000` — see `SG.orderTotal()`. |
| Currency | **Nigerian Naira (₦)** everywhere — `SG.CURRENCY = "NGN"`, formatted by `SG.money()`. |
| Who sets the rates? | **The admin**, per service, in the console (rate per 1,000, min, max, quality label). |
| Where are rates shown? | `pricing.html` (signed-in rate card), `order.html` + dashboard boost panel, homepage teaser. |
| When is money taken? | The displayed amount is debited from the wallet atomically when the order is submitted. Rejected orders are refunded. |

The boost panel is one shared component — `assets/js/panel.js` renders into any
`[data-boost-panel]` element, so `order.html` and the dashboard **Boost** tab stay identical.
Add `?preview=1` to `order.html` or `dashboard.html` to render the UI while signed out (the page
guard lets the shell through, no private data is loaded). A signed-in but unverified client is still sent
to `verify-email.html`; checkout requires a verified account, a funded wallet and a seeded Firestore service catalogue.

---

## Admin console (`admin.html`)

Access is restricted to **okogbagideon28@gmail.com**, **okogbaeladopere@gmail.com** and
**beniwealth70@gmail.com** — the allowlist is checked in the browser (`SG.ADMIN_EMAILS` in
`assets/js/firebase.js`) and again in Firestore security rules. To change it, update both allowlists
and deploy with `firebase deploy --only firestore:rules`.

### Signing in as admin

`admin.html` carries `data-auth-gate="inline"`, so signed-out visitors see the console's own
sign-in panel instead of being bounced to `login.html`. All three configured admin accounts can use
the console with email/password or Google sign-in, whether or not the email-verification link has
been opened. An unverified allowlisted admin sees a small reminder in the console, not a blocking gate.

| State | What you see | What to do |
| --- | --- | --- |
| Signed out | **Continue with Google** + an admin email/password form | Sign in with one of the three allowed admin accounts |
| Allowed admin, email not verified | The admin console and a non-blocking verification reminder | Continue in the console; verify the address for better account recovery |
| Somebody else's account | *"This account does not have admin access"* + **Switch to the owner account** | Sign out, then use one of the three allowed accounts |
| Allowed owner, verified | The admin console | — |

Notes:

- **Every email/password signup sends a verification link.** Ordinary accounts must verify before
  opening the dashboard, order page, rate card or other protected client pages. An unverified user is
  sent to `verify-email.html`, where they can resend the link and refresh their verification status.
- **The three listed admin addresses are deliberately exempt from that client gate.** Their admin
  access is also allowed in Firestore rules, so reads and changes in the console work before
  verification. Keep these addresses reserved to the actual admin accounts, use strong credentials
  and enable multi-factor authentication in Firebase; do not leave an unclaimed admin address open
  to public registration.
- **Google needs no separate verification email.** Google has already proven the mailbox, so client
  pages are available with Google sign-in.
- Email verification status can be cached by Firebase. The verification page reloads the user and
  forces a fresh ID token when checking whether access is ready.
- Google sign-in is also offered on `login.html` and `signup.html` (`data-google-signin`).
- Rules are only live once deployed: `firebase deploy --only firestore:rules`.

### What the admin can do

| Tab | What it does |
| --- | --- |
| **Overview** | Live counts: awaiting approval, in progress, completed, pipeline value + open queue sorted by priority and recent activity |
| **Orders** | Filter by status (pending / approved / ongoing / completed / rejected), search and process orders; rejecting refunds the client wallet atomically |
| **Wallet top-ups** | View Base64 receipt images, verify incoming payments and approve/reject requests; approval credits the wallet and ledger atomically |
| **Boost services** | Add, edit, pause, delete services and set the **rate per 1,000 (₦)**, **min/max quantity**, quality label, start time and **processing priority** on each |
| **Leads** | Contact-form briefs with reply-by-email / WhatsApp buttons |
| **Subscribers** | Newsletter list with a *copy all emails* button |

### Order workflow

```
        ┌──────────── user  submits ────────────┐
        ▼                                        │
   ┌─────────┐   admin    ┌──────────┐  admin ┌───────────┐  admin  ┌───────────┐
   │ PENDING │ ─────────▶ │ APPROVED │ ─────▶ │  ONGOING  │ ──────▶ │ COMPLETED │
   └─────────┘  approves  └──────────┘  starts└───────────┘finishes└───────────┘
        │                        ▲                  │                    │
        │ admin rejects          │ admin reopens    │  admin can reopen  │
        ▼                        │                  ▼                    │
   ┌──────────┐ ─────────────────┘                                       │
   │ REJECTED │ ◀──────────────────────────────────────────────────────┘
   └──────────┘
```

* New orders are **always created with `status: "pending"`** — enforced by the security rules,
  not just the UI.
* The admin can attach a **note to the customer** with any status change (e.g. why an order was
  rejected).
* Every change is appended to the order's `history` (status, timestamp, admin email, note) so
  there is a full audit trail.
* The admin can also **override the priority of an individual order** at any time.
* Users follow along live: the status pill and the four-step progress track appear on their
  dashboard and keep them informed without any email chasing.

### Processing priorities

Priorities decide the order jobs are worked on when several are queued. Set them per service in
**Boost services → Processing priority**; the queue on the overview tab is sorted Urgent → High →
Normal → Low, then oldest first.

| Priority | Rank | Intended use |
| --- | --- | --- |
| Urgent | 1 | Jump the queue — process first (fast-fill services) |
| High | 2 | Prioritised over normal work |
| Normal | 3 | Standard turnaround |
| Low | 4 | Fill-in work, processed last |

The catalogue ships with **22 starter services** (`SG.DEFAULT_SERVICES`) across Instagram, TikTok,
YouTube, Facebook, X, Telegram, WhatsApp, music streaming, website traffic, comments and live
streams — each with a naira rate per 1,000, min/max quantity and a default priority. The console
offers a one-click **Import starter catalogue** when Firestore is empty; until then the site falls
back to that built-in list so ordering works on day one.

---

## Project structure

```
.
├── index.html, services.html, ...      # 27 static pages
├── assets/
│   ├── css/
│   │   ├── style.css                   # Design tokens, layout, nav, footer, components
│   │   ├── pages.css                   # Case studies, blog, auth, dashboard
│   │   └── admin.css                   # Admin console, boost panel, rate card table
│   └── js/
│       ├── firebase.js                 # Firebase app, lazy SDK loader, window.SG API,
│       │                               #   admin identity, boost services, order helpers
│       ├── site.js                     # Nav, reveal animations, filters, accordions, toast
│       ├── auth.js                     # Sign-up/in/out, nav auth state, dashboard
│       ├── contact.js                  # Contact form → Firestore → thank-you.html
│       ├── orders.js                   # Shared order renderers + dashboard order list
│       ├── panel.js                    # The boost panel (buy page) — order.html + dashboard
│       ├── rates.js                    # Public rate card (pricing.html) + home teaser
│       └── admin.js                    # Admin console: orders, rates, priorities, catalogue
├── firebase.json                       # Firebase Hosting + Firestore config
├── .firebaserc                         # Default project: sonicgidsempire
├── firestore.rules                     # Security rules for leads / subscribers
└── firestore.indexes.json              # Composite index for the dashboard query
```

Every page is self-contained: the shared header, footer and floating WhatsApp button are
written into each HTML file, wrapped in `<!-- shared:header:start -->` … `<!-- shared:header:end -->`
markers.

**Updating the menu or footer:**

1. Edit the header/footer in `index.html`.
2. Run `node tools/sync-shared.js` — every other page is updated to match.
3. `404.html` is skipped on purpose because it has a host-aware `<base>` element for Firebase and GitHub Pages.

The script finds the blocks by structure, so it also repairs pages where the nav or footer was
edited by hand. To add a brand new page, copy an existing page, change the `<title>`,
`<meta name="description">`, canonical URL and `<main>` content, then run the sync script.

**Running the checks:**

```bash
node tools/test-workflow.js     # 191 checks: auth/verification, admin identity, private-page gates,
                                # top-up receipts, status workflow, rules text and page wiring
```

Run this after changing anything in `assets/js/` or `firestore.rules`.

---

## Run locally

No tooling required. Any static server works:

```bash
# Python
python3 -m http.server 8080

# or Node
npx serve .
```

Then open http://localhost:8080

> Opening the files directly with `file://` mostly works, but the contact form, login and
> dashboard need a real HTTP origin for Firebase Authentication to function.

---

## Firebase setup

The site uses the `sonicgidsempire` Firebase project. The web config lives at the top of
`assets/js/firebase.js`. To activate everything, enable the following in the
[Firebase console](https://console.firebase.google.com/project/sonicgidsempire):

1. **Authentication → Sign-in method → Email/Password → Enable**, and also enable
   **Google** if you want one-click owner access to the admin console. Registration uses Firebase's
   built-in email-address verification template; customize its wording under **Authentication → Templates** if needed.
2. **Authentication → Settings → Authorized domains** — add your custom domain when you connect it.
3. **Firestore Database → Create database** (production mode). Then deploy the rules in this repo:

   ```bash
   npm install -g firebase-tools   # once
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. In the owner console, open **Boost services** and import the starter catalogue (or add services).
   Checkout validates each amount against this server-managed Firestore catalogue.
5. **Analytics** is enabled by the measurement ID already in the config. It only loads on
   HTTPS or localhost, and never blocks page rendering.

### Data model

| Collection | Written by | Fields |
| --- | --- | --- |
| `leads` | `contact.html` brief form | `name`, `email`, `company`, `phone`, `service`, `budget`, `message`, `source`, `page`, `uid`, `createdAt` |
| `subscribers` | Footer / blog newsletter | `email`, `page`, `createdAt` |
| `orders` | Boost panel (`order.html` / dashboard) | `ref`, `uid`, `email`, `contactName`, `contactPhone`, `brand`, `serviceId`, `serviceName`, `platform`, `category`, `unit`, `unitLabel`, `packageLabel`, `quantity`, `quantityNum`, `ratePer1000`, `currency`, `amount`, `priority`, `priorityRank`, `targetLink`, `notes`, `status`, `adminNote`, `history[]`, `createdAt`, `updatedAt` |
| `boostServices` | Admin console | `name`, `platform`, `category`, `unit`, **`ratePer1000`**, `currency`, **`min`**, **`max`**, `type`, `priceFrom` (legacy mirror), `turnaround`, `priority`, `priorityRank`, `description`, `active`, `createdAt`, `updatedAt` |
| `wallets/{uid}` | Atomic checkout / admin credit | `balance`, `currency`, `updatedAt`, `lastTransactionId` |
| `walletTransactions` | Atomic checkout / admin review | Immutable owner-scoped credits and debits, `amount`, `balanceAfter`, source and related order / top-up |
| `walletTopups` | Client request / admin review | `uid`, `email`, `amount`, `reference`, `status`, `createdAt`, review audit fields |
| `walletTopupProofs/{topupId}` | Atomic client upload / admin review | Compressed JPEG `proofDataUrl` (Base64), owner UID; admin-only reads and removed after review |

Security summary enforced by `firestore.rules`:

* Anyone may **create** a lead or subscriber; only the admin may read them.
* A verified client (or Google-authenticated client) may create an order only when the price,
  quantity and priority match the active Firestore service catalogue. Unverified accounts cannot
  read private client records or create orders. Order creation, wallet debit and immutable ledger
  entry are one transaction. Clients can read only their own orders and cannot edit financial or status fields.
* Anyone may **read** `boostServices` — the signed-in rate card uses the same catalogue — but only the
  admin can create services or change a rate, min or max.
* Wallet top-ups use the company Moniepoint account **8077055122** (Okogba Gideon Eladopere Chizaram).
  Clients submit a receipt image, compressed and stored as Base64 in a separate admin-only collection.
  Requests remain pending and do not affect balance until an admin reviews the receipt and approves;
  the image is deleted after review. Rejected orders trigger an atomic refund.
* Protected client pages are hidden behind the browser auth guard until a regular account is verified.
  Firebase Hosting serves static files, so Firestore rules—not the page guard—are the security boundary
  for private data. The exact three-address admin allowlist is the explicit verification exception.

### The `window.SG` API

`assets/js/firebase.js` exposes a small, defensive helper layer:

```js
await window.SGReady;                       // resolves once Firebase is ready

// auth
SG.signUp(email, password, name)              // creates account + sends verification email
SG.signIn(email, password)
SG.signInWithGoogle()
SG.signOut()
SG.resetPassword(email)
SG.sendVerificationEmail([user])            // send/resend to current or specified user
SG.onUser(cb)

// identity
SG.ADMIN_EMAILS                            // the three configured admin addresses
SG.ADMIN_EMAIL                             // primary owner address (first entry)
SG.isAdminEmail(email)                     // case/space tolerant
SG.isVerifiedUser(user)                    // verified email or trusted Google sign-in
SG.adminStatus(user)                       // signed-out | not-admin | owner
SG.isAdminUser(user)                       // true only for an allowlisted admin
SG.refreshUser()                           // reload profile + force a fresh ID token

// leads & subscribers
SG.saveLead({ ... })                        // → leads collection
SG.saveSubscriber(email)                    // → subscribers collection
SG.myLeads()

// money — naira, per 1,000
SG.CURRENCY / SG.CURRENCY_SYMBOL            // "NGN" / "₦"
SG.money(value)                             // 2500 → "₦2,500"
SG.rateOf(service)                          // ratePer1000, falls back to legacy priceFrom
SG.orderTotal(ratePer1000, quantity)        // (qty / 1000) × rate
SG.serviceMin(service) / SG.serviceMax(service)

// boost services
SG.DEFAULT_SERVICES                         // 22 starter services with ₦ rates
SG.PRIORITIES                               // urgent | high | normal | low
SG.priorityRank(key) / SG.priorityLabel(key)
SG.listBoostServices(activeOnly)
SG.adminSaveService(id, data)
SG.adminDeleteService(id)
SG.adminSeedServices()

// orders
SG.ORDER_STATUSES                           // pending | approved | rejected | ongoing | completed
SG.NEXT_STATUSES / SG.canMoveTo(from, to)   // allowed transitions
SG.walletBalance() / SG.myWalletActivity()
SG.requestWalletTopup(amount, reference, base64ReceiptDataUrl)
SG.createOrder({ ... })                     // pending; atomically debits wallet
SG.myOrders()
SG.adminListOrders()
SG.adminUpdateOrder(id, { status }, note)   // admin: approve / reject / start / complete

// admin lists
SG.adminListLeads() / SG.adminListSubscribers()

// misc
SG.logEvent(name, params)
SG.friendlyError(err) / SG.friendlyDbError(err)
```

The SDK is imported lazily from the Firebase CDN after the page loads, so it never slows the
first paint. The legacy compat snippet is not used — this is the modular v10 SDK.

---

## Deploy to Firebase Hosting

```bash
firebase login
firebase use sonicgidsempire
firebase deploy --only hosting
```

The site then serves at https://sonicgidsempire.web.app (project default) and maps to
https://sonicgidsempire.firebaseapp.com. Connect a custom domain under
**Hosting → Add custom domain** when ready.

Deploying from GitHub instead? Run the same command in a GitHub Action, or use
**Hosting → GitHub integration** in the console.

---

## Brand reference

| Item | Value |
| --- | --- |
| Name | Sonicgids Empire |
| Positioning | Full-service social media marketing agency |
| Studio | Warri, Delta State, Nigeria |
| Email | okogbagideon28@gmail.com |
| WhatsApp | +234 703 832 2626 |
| Instagram | [@sonicgidsX](https://instagram.com/sonicgidsX) |
| X | [@SonicgidsX](https://x.com/SonicgidsX) |
| Colours | Gold `#d9a51b` accent + ink `#12141a` on white `#ffffff` (light UI, see `assets/css/style.css` tokens) |
| Fonts | Outfit (headings), Inter (body) |

Update these in one place per page — the footer, contact page and service CTAs.

---

## Testing checklist before launch

- [ ] `firebase deploy --only firestore:rules` and confirm the rules upload without errors
- [ ] Sign in at `/admin.html` with the owner account and confirm the console loads
- [ ] Sign in with a *different* account and confirm it is refused admin access
- [ ] **Boost services → Import starter catalogue**, then check a rate per 1,000, min/max and priority
- [ ] Open `/pricing.html` logged out and confirm the live rate table shows the same ₦ rates
- [ ] Open `/order.html?preview=1` and `/dashboard.html?preview=1` to review the layouts without signing in
- [ ] Create a regular test account, confirm the Firebase verification link arrives, and verify that the dashboard/order pages stay blocked until verification; use the re-check control on `verify-email.html`
- [ ] Sign in with each allowlisted admin account (including `beniwealth70@gmail.com`, while unverified) and confirm `admin.html` and its Firestore data load; confirm other unverified accounts cannot read client data
- [ ] Submit a wallet top-up with a receipt image; confirm it remains pending and the balance is unchanged
- [ ] In **Admin → Wallet top-ups**, open the Base64 receipt, verify the Moniepoint transfer, approve, and confirm the wallet/ledger credit; reject a second request and confirm it adds no funds
- [ ] Pick a service, enter a quantity and confirm the **amount (₦)** = qty ÷ 1,000 × rate
- [ ] Try a quantity below the minimum and above the maximum — both must be blocked with a message
- [ ] Place the order and confirm it saves as **pending** with `ratePer1000` and `quantityNum` set
- [ ] Confirm the dashboard **Boost** tab and **My orders** tab both update after ordering
- [ ] In the admin console: approve it → start it → complete it, and watch the dashboard update
- [ ] Reject an order with a note and confirm the customer sees the reason
- [ ] Submit the contact form and confirm the entry appears in Firestore → `leads` and under the Leads tab
- [ ] Subscribe through the footer newsletter and check `subscribers`
- [ ] Visit a non-existent URL to see `404.html`
- [ ] Run Lighthouse on `index.html` (target 90+ performance, 100 accessibility)

### Deploying rules only

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

© Sonicgids Empire. All rights reserved.
