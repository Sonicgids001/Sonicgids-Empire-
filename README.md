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
| Client login | `login.html` | Firebase email/password sign-in |
| Create account | `signup.html` | Firebase account creation |
| Reset password | `forgot-password.html` | Password reset email |
| Client dashboard | `dashboard.html` | Auth-gated performance panel |
| 404 | `404.html` | Custom not-found page |
| Legal | `privacy.html`, `terms.html` | Privacy policy and terms of service |

Also included: `sitemap.xml`, `robots.txt`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`.

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
│       ├── firebase.js                 # Firebase app + lazy SDK loader, window.SG API
│       ├── site.js                     # Nav, reveal animations, filters, accordions, toast
│       ├── auth.js                     # Sign-up/in/out, nav auth state, dashboard
│       └── contact.js                  # Contact form → Firestore → thank-you.html
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

To add a brand new page, copy an existing page, change the `<title>`, `<meta name="description">`,
canonical URL and `<main>` content, keep the markers intact, then run the sync script.

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

1. **Authentication → Sign-in method → Email/Password → Enable.**
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

Security rules allow anyone to **create** a lead or subscriber, but only a signed-in client
can read their own leads. Nothing else is publicly readable.

### The `window.SG` API

`assets/js/firebase.js` exposes a small, defensive helper layer:

```js
await window.SGReady;                       // resolves once Firebase is ready
SG.signUp(email, password, name)            // create an account
SG.signIn(email, password)                  // sign in
SG.signOut()
SG.resetPassword(email)
SG.onUser(cb)                               // auth state listener
SG.saveLead({ ... })                        // → leads collection
SG.saveSubscriber(email)                    // → subscribers collection
SG.myLeads()                                // current user's recent briefs
SG.logEvent(name, params)                   // Firebase Analytics
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

- [ ] Submit the contact form and confirm the entry appears in Firestore → `leads`
- [ ] Create a test client account, sign in, and confirm `dashboard.html` loads
- [ ] Sign out and confirm the nav switches back to “Client Login”
- [ ] Subscribe through the footer newsletter and check `subscribers`
- [ ] Visit a non-existent URL to see `404.html`
- [ ] Run Lighthouse on `index.html` (target 90+ performance, 100 accessibility)

---

© Sonicgids Empire. All rights reserved.
