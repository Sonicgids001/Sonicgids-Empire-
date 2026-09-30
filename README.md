# Sonicgids Empire — Social Media Marketing Agency Website

Official website for **Sonicgids Empire**, a full-service social media marketing agency
(strategy, content, paid media, SEO and influencer marketing).

Built as a **plain static site** — HTML, CSS and vanilla JavaScript, no build step and no
dependencies to install. Deploy the folder anywhere; it runs as-is.

> Replaced the original single `profile.html` page with a complete 27-page agency website.

---

## Pages

| Page | File | Purpose |
| --- | --- | --- |
| Home | `index.html` | Hero, services, stats, process, proof, pricing teaser, FAQ |
| Services overview | `services.html` | All five service lines + supporting work |
| Social Media Management | `service-social.html` | Service detail with deliverables, process, FAQ |
| Paid Advertising | `service-ads.html` | Service detail |
| Content & Creative Studio | `service-content.html` | Service detail |
| SEO & Web | `service-seo.html` | Service detail |
| Influencer Marketing | `service-influencer.html` | Service detail |
| Case Studies | `case-studies.html` | Filterable results by industry |
| Pricing | `pricing.html` | Monthly/quarterly tiers, comparison table, add-ons |
| Insights (blog) | `blog.html` | Featured post, category filter, newsletter |
| Articles | `blog-*.html` (6) | Full articles: playbook, Instagram, Meta ads, hooks, metrics, local SEO |
| About | `about.html` | Story, principles, team, timeline |
| FAQ | `faq.html` | Grouped answers with FAQ schema |
| Contact | `contact.html` | Brief form → Firestore, direct contact lines |
| Thank you | `thank-you.html` | Post-submission confirmation |
| Boost services / orders | `order.html` | Catalogue + order form (orders start as **pending**) |
| Client login | `login.html` | Firebase email/password or Google sign-in |
| Create account | `signup.html` | Firebase account creation |
| Reset password | `forgot-password.html` | Password reset email |
| Client dashboard | `dashboard.html` | Auth-gated panel: orders by status, objectives, roadmap |
| **Admin console** | `admin.html` | **Owner-only.** Process orders, set boosting priorities, manage the catalogue |
| 404 | `404.html` | Custom not-found page |
| Legal | `privacy.html`, `terms.html` | Privacy policy and terms of service |

Also included: `sitemap.xml`, `robots.txt`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `tools/`.

---

## Admin console (`admin.html`)

Access is restricted to **okogbagideon28@gmail.com** — the check runs both in the browser
(`SG.ADMIN_EMAIL` in `assets/js/firebase.js`) **and** in Firestore security rules, so nobody
can bypass it by editing the page source.

### Signing in as admin

1. Open `/admin.html` and choose **Continue with Google**, then pick the owner Google account.
   Google sign-in returns a verified email, which is what the rules require.
   *Alternatively* sign in with email + password at `/login.html` — the owner account is then
   redirected straight to the admin console.
2. Using email + password, the address must be **verified**. The console shows a yellow banner
   with a **Send verification email** button when it isn't. Verified email is required because
   Firestore rules check `email_verified == true`.
3. Anyone else who signs in sees *"This account does not have admin access"* and is offered
   their client dashboard instead.

### What the admin can do

| Tab | What it does |
| --- | --- |
| **Overview** | Live counts: awaiting approval, in progress, completed, pipeline value + open queue sorted by priority and recent activity |
| **Orders** | Filter by status (pending / approved / ongoing / completed / rejected), search by reference, client, service or link, and process each order |
| **Boost services** | Add, edit, pause, delete boosting services and **set the processing priority** on each |
| **Leads** | Contact-form briefs with reply-by-email / WhatsApp buttons |
| **Subscribers** | Newsletter list with a *copy all emails* button |

### Order workflow

```
        ┌──────────── client submits ────────────┐
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
* The admin can attach a **note to the client** with any status change (e.g. why an order was
  rejected).
* Every change is appended to the order's `history` (status, timestamp, admin email, note) so
  there is a full audit trail.
* The admin can also **override the priority of an individual order** at any time.
* Clients follow along live: the status pill and the four-step progress track appear on their
  dashboard and keep the client informed without any email chasing.

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

The catalogue ships with 14 starter services, each with a sensible default priority. The console
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
│   │   └── pages.css                   # Pricing, case studies, blog, auth, dashboard
│   └── js/
│       ├── firebase.js                 # Firebase app, lazy SDK loader, window.SG API,
│       │                               #   admin identity, boost services, order helpers
│       ├── site.js                     # Nav, reveal animations, filters, accordions, toast
│       ├── auth.js                     # Sign-up/in/out, nav auth state, dashboard
│       ├── contact.js                  # Contact form → Firestore → thank-you.html
│       ├── orders.js                   # Boost catalogue, order form, status rendering
│       └── admin.js                    # Admin console: orders, priorities, catalogue
├── firebase.json                       # Firebase Hosting + Firestore config
├── .firebaserc                         # Default project: sonicgidsempire
├── firestore.rules                     # Security rules for leads / subscribers
└── firestore.indexes.json              # Composite index for the client dashboard query
```

Every page is self-contained: the shared header, footer and floating WhatsApp button are
written into each HTML file, wrapped in `<!-- shared:header:start -->` … `<!-- shared:header:end -->`
markers.

**Updating the menu or footer:**

1. Edit the header/footer in `index.html`.
2. Run `node tools/sync-shared.js` — every other page is updated to match.
3. `404.html` is skipped on purpose because it uses root-absolute links.

The script finds the blocks by structure, so it also repairs pages where the nav or footer was
edited by hand. To add a brand new page, copy an existing page, change the `<title>`,
`<meta name="description">`, canonical URL and `<main>` content, then run the sync script.

**Running the checks:**

```bash
node tools/test-workflow.js     # 72 assertions: admin identity, status workflow,
                                # renderers, rules text and page wiring
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
   **Google** if you want one-click owner access to the admin console.
2. **Authentication → Settings → Authorized domains** — add your custom domain when you connect it.
3. **Firestore Database → Create database** (production mode). Then deploy the rules in this repo:

   ```bash
   npm install -g firebase-tools   # once
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. **Analytics** is enabled by the measurement ID already in the config. It only loads on
   HTTPS or localhost, and never blocks page rendering.

### Data model

| Collection | Written by | Fields |
| --- | --- | --- |
| `leads` | `contact.html` brief form | `name`, `email`, `company`, `phone`, `service`, `budget`, `message`, `source`, `page`, `uid`, `createdAt` |
| `subscribers` | Footer / blog newsletter | `email`, `page`, `createdAt` |
| `orders` | `order.html` order form | `ref`, `uid`, `email`, `contactName`, `contactPhone`, `brand`, `serviceId`, `serviceName`, `platform`, `category`, `unit`, `packageLabel`, `quantity`, `amount`, `priority`, `priorityRank`, `targetLink`, `notes`, `status`, `adminNote`, `history[]`, `createdAt`, `updatedAt` |
| `boostServices` | Admin console | `name`, `platform`, `category`, `unit`, `priceFrom`, `turnaround`, `priority`, `priorityRank`, `description`, `active`, `createdAt`, `updatedAt` |

Security summary enforced by `firestore.rules`:

* Anyone may **create** a lead or subscriber; only the admin may read them.
* A signed-in client may create an order (pinned to `status: "pending"` and their own `uid`) and
  read only their own orders. They can never write `status`, `history`, `adminNote` or `priority`.
* Only the verified owner address may read all orders, change statuses/priorities, or write the
  boosting catalogue.

### The `window.SG` API

`assets/js/firebase.js` exposes a small, defensive helper layer:

```js
await window.SGReady;                       // resolves once Firebase is ready

// auth
SG.signUp(email, password, name)
SG.signIn(email, password)
SG.signInWithGoogle()
SG.signOut()
SG.resetPassword(email)
SG.sendVerificationEmail()
SG.onUser(cb)

// identity
SG.ADMIN_EMAIL                             // "okogbagideon28@gmail.com"
SG.isAdminEmail(email) / SG.isAdminUser(user)

// leads & subscribers
SG.saveLead({ ... })                        // → leads collection
SG.saveSubscriber(email)                    // → subscribers collection
SG.myLeads()

// boost services
SG.PRIORITIES                               // urgent | high | normal | low
SG.priorityRank(key) / SG.priorityLabel(key)
SG.listBoostServices(activeOnly)
SG.adminSaveService(id, data)
SG.adminDeleteService(id)
SG.adminSeedServices()

// orders
SG.ORDER_STATUSES                           // pending | approved | rejected | ongoing | completed
SG.NEXT_STATUSES / SG.canMoveTo(from, to)   // allowed transitions
SG.createOrder({ ... })                     // always created as "pending"
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
| Colours | Gold `#d4af37` on near-black `#07070a` |
| Fonts | Outfit (headings), Inter (body), Playfair Display (accents) |

Update these in one place per page — the footer, contact page and service CTAs.

---

## Testing checklist before launch

- [ ] `firebase deploy --only firestore:rules` and confirm the rules upload without errors
- [ ] Sign in at `/admin.html` with the owner account and confirm the console loads
- [ ] Sign in with a *different* account and confirm it is refused admin access
- [ ] **Boost services → Import starter catalogue**, then set a couple of priorities
- [ ] Create a test client account and place an order — confirm it saves as **pending**
- [ ] In the admin console: approve it → start it → complete it, and watch the client dashboard update
- [ ] Reject an order with a note and confirm the client sees the reason
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
