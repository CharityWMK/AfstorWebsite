# Afstor website — content map

Where every piece of the previous one-page site now lives, what was newly written, and what still needs real content. Content gaps are listed here only; the site itself no longer shows gap markers, except the cooking times on Solutions.

## New site structure

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Hero, pathway selector, impact strip, problem/solution, how it works, products, impact, field photos, certifications, final CTA |
| Solutions | `solutions.html` | Cooking system (4 highlights, no prices), "Powered by the Sun" callout, what you can cook, institutional range, full FAQ |
| Households | `households.html` | Consumer pathway: benefits, payment options & pay-as-you-go, where to buy, support, FAQ, order form. "Get Your Cooker" buttons open the Contact form preset to Household |
| Distributors & partners | `distributors.html` | Partnership model, partner support, onboarding, territories ("We deliver everywhere in Kenya"), application form |
| Schools & institutions | `institutions.html` | Institutional solutions, savings estimator, installation, quote form |
| Development organisations | `development-partners.html` | Programme models, distribution at scale, impact measurement, SDGs, collaboration form |
| Investors & government | `investors.html` | Opportunity, business model, carbon, policy, governance, investor/meeting form. No consumer messaging. |
| Impact | `impact.html` | Health, environment (forests and CO₂), household savings beside the impact-banner photo; direct and secondary SDGs |
| About | `about.html` | Text-only intro, story, vision, mission, values |
| Insights | `news.html` | Blog: featured SOLCO story, listing (SOLCO + video card), LinkedIn |
| SOLCO article | `news-solco-partnership.html` | Partnership announcement with live LinkedIn embed, commitments strip, quote, share buttons |
| Contact | `contact.html` | Contact cards, segmented enquiry form (routes by stakeholder), map |
| Privacy Policy | `privacy.html` | Kenya Data Protection Act notice; linked from every form's consent box and the footer |
| Design system | `design-system.html` | Internal reference (not indexed by search engines) |

Pathways are reachable from: the home hero ("Partner With Us" → pathway selector), the "Who We Serve" menu, the footer, and the strip at the bottom of every pathway page.

## Where existing content moved

| Previous section / item | New location(s) |
|---|---|
| Utility bar: phone +254 181 100 200, LinkedIn | Utility bar (desktop), footer, mobile Call/WhatsApp bar |
| Logo | Header, footer, favicon |
| Hero: "Impact That MATTERS/LASTS/COUNTS/LEADS" | Replaced by the new value proposition with a rotating word (home/school/clinic/community) |
| Hero description (old "integrated solar-powered energy system" copy) | Rewritten as cooking-only copy (Afstor offers clean cooking solutions only): Solutions hero, Home "How it works" intro |
| Hero CTA "Get Yours Today" | "Get Your Cooker" (Households, Solutions, Home) → Contact form preset to Household |
| Hero image `Open cookers.jpg` | Resized to `images/optimized/assembly-line-*.jpg`; used on Home (products, field), Distributors, Development, About, Solutions |
| About copy, paragraph 1 ("For millions of families…") | Home "The problem"; About "Our story"; Investors "Opportunity" |
| About copy, paragraphs 2–5 | About "Our story" (verbatim, lightly edited) |
| About copy, "tracks its own impact" | Home "How Afstor solves it"; Solutions highlight "Built-in tracking"; Development "Impact measurement"; Investors "Carbon" |
| Closing vision paragraph ("We're not just selling a product…") | About hero lead |
| YouTube video (wodoyiWW3rU) | Blog video card (removed from About on 26 Nov 2026) |
| Vision | About; Investors pull quote |
| Mission | About |
| Core values (6) | About values grid; Investors governance references integrity/professionalism/quality |
| Product: 450W Solar Panels (copy, specs, WhatsApp enquiry) | Home products card. The Solutions "Inside the system" component cards were replaced by the "Powered by the Sun" callout |
| Product: Solar-Induction Cooking System (copy, 4 features, WhatsApp enquiry) | Solutions → Cooking system (now 4 highlights incl. 12V DC charge input; prices removed); Home products card; Households payment options |
| "What you can cook" (7 dishes, cooking times) | Solutions → What you can cook (serving note for a family of 8) |
| Impact: "How does Afstor solve the problem?" (100% solar, zero CO₂) | Home "How Afstor solves it"; Impact hero |
| Impact: 260,000 km over five years | Home stat strip; Impact "Climate"; Investors carbon figures |
| Impact: tracking website | Solutions highlight, Households support, Development, Investors |
| Images `fam.webp`, `Solar_roof.webp`, `carrying-wood2.webp` | Home, Households, Development, About, Institutions, Impact, Investors, Insights |
| SDGs: 7 direct + 4 secondary, tier copy | Impact → SDGs (both tiers, verbatim); Development → SDG alignment (direct) |
| FAQ (9 questions) | Solutions → FAQ (all 9); Households → 4 most relevant |
| FAQ: payment plans (KES 96,000 / KES 20,000 + 4,000 × 24) | Households payment-option cards and FAQ; Distributors; Investors business model (removed from Solutions) |
| FAQ: KES 52,000 a year saving | Home stat strip; Households benefits; Impact "Economic" |
| FAQ: up to 4 hours after sunset | Home hero badge and "How it works"; Households; Solutions |
| FAQ: delivery, installation, 2-year warranty, technicians | Home hero proof points; Households support; Institutions installation |
| FAQ: schools, clinics, churches, community groups, bulk discount | Institutions page; Solutions institutional section |
| Contact: sales.ke@afstor.com, +254 182 241 801 | Sales email: contact cards, footer, Households/Institutions forms. The sales phone number was removed on 27 Nov 2026; +254 181 100 200 is the only number |
| Footer: office@afstor.com, 38988 Infinity Industrial Park | Contact cards and "Visit us", footer, Development/Investor forms |
| Contact form (single form, request-type dropdown) | Replaced by a stakeholder form on each pathway page plus a segmented form on Contact. Routing is set in `send-contact.php` |
| Map embed | Contact → Visit us |
| Footer blurb | Footer (unchanged) |
| WhatsApp floating button | Desktop floating button; on mobile, a bottom bar with Call / WhatsApp / Enquire. The pre-filled message changes per page |

### Facts added from existing Afstor material (not in the old site text)
- "Saves up to 4,000 kg firewood per year" and "Reduces 6,400 kg CO₂ emissions annually": from the Afstor roll-up banner in `Cookstove.jpeg`.
- "Gold Standard certified SDG impacts": from the banner on `fam.webp`. **Please confirm this certification can be stated publicly.** The banner itself is cropped out of the photo wherever it appears.
- "Clean Energy · Smart Cooking": banner tagline, used in the footer.

### Removed
- Facebook, Instagram, X, YouTube and TikTok icons: they linked to `#`. Add them back in `src/partials/header.html` / `footer.html` once the real URLs exist.
- Hero slide 2: it pointed to `images/hero/hero-slide-2.jpg`, which doesn't exist, with an Unsplash stock fallback.
- Unused images left in place but not used: `products/Battery.jpg`, `impact/sdg/sdg-5.png` (duplicate of SDG 5 webp), the original `WhatsApp Image…jpeg` and `Open cookers.jpg` (resized copies are used instead).

## Content still to supply (not shown on the site)

| Where | What's needed |
|---|---|
| Home stat strip (HTML comment) | Network totals: households served, institutions supplied, total CO₂ avoided. These should lead the strip once available |
| Home "From the field" | Customer testimonials / named case studies |
| Home certifications | Partner and funder logos |
| Solutions | Cooking times for the six dishes |
| Households → Where to buy | Showroom visiting hours |
| Distributors | Standard margin range, minimum order; priority counties |
| Institutions | Institutional system sizes |
| Development | Monthly assembly capacity and installed base |
| Investors | Specific national/county policy references; board, leadership, auditors |
| All pages | Real photos of people cooking with Afstor in Kenyan homes, schools and institutions. The current hero shows an installation |

## Proposed wording to review
These sections were written for the new structure and describe how Afstor works. Please check they match practice:
- Distributors: partner types, "What partners receive", 5-step onboarding.
- Institutions: 5-step installation process.
- Development: three collaboration models.
- Investors: four revenue routes (incl. carbon & results-based finance), policy alignment.
- Forms: "We reply within one working day."

## Editing the site
Edit the files in `src/pages/` and the shared header/footer in `src/partials/`, then run:

```
python src/build.py
```

This regenerates the `.html` files in the site root, which is what cPanel deploys. Do not edit the root `.html` files directly; the next build overwrites them.

## Update log
- **26 Nov 2026**: Clean-cooking-only messaging across the site; "Home" link added to the menu; enquiry-led "Get Your Cooker" buttons; Solutions prices and component cards removed; Impact "Transparent tracking" section, the Investors metrics section, Institutions "Case studies" and About "Our team" removed; SOLCO Partnership article added. The company vision now reads "…off-grid cooking solutions…" (was "…cooking and distributed energy solutions…") and the mission "…solar cooking solutions…" (was "…solar energy solutions…").
- **26 Nov 2026 (later)**: About: hero photo, "Watch" video section and "Made in Kenya" section removed. Blog: category labels and unwritten article slots removed; SOLCO article now embeds the live LinkedIn post. All on-site gap markers removed except cooking times; the gaps remain listed above.
