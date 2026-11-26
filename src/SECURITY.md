# Afstor website: security runbook

Internal. Blocked from public access by `.htaccess` (everything under `src/` and all `.md` files).

## What is in place

| Area | Where | What it does |
|---|---|---|
| HTTPS | `.htaccess` | 301 redirect from HTTP to HTTPS; HSTS for one year incl. subdomains |
| Security headers | `.htaccess` | `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `X-Powered-By` removed |
| Content Security Policy | `.htaccess` | Strict allow-list, no `unsafe-inline`/`unsafe-eval`. **Currently Report-Only** (see below) |
| CSP reports | `csp-report.php` | Logs violations (directive + blocked host + page path only) to `../afstor-private/logs/csp-YYYY-MM.log` |
| Hidden & sensitive files | `.htaccess` | Blocks dot-files (`.git`, `.env`, `.htaccess`, `.user.ini` ...), `src/`, and `.md .py .yml .ini .log .sql .bak .zip .json` etc.; directory listing off; scripts can't run from `images/` |
| PHP errors | `.user.ini`, `.htaccess`, `send-contact.php` | Errors never shown to visitors |
| Staging privacy | `.htaccess`, `robots-staging.txt` | On any `staging.` host: `X-Robots-Tag: noindex, nofollow` and a disallow-all robots.txt. Production is unaffected automatically; nothing to remove at go-live |
| Forms (server) | `send-contact.php` | Same-origin check, JSON-only, 12 KB cap, honeypot (silent fake success), unexpected-field rejection, CSRF token bound to a `Secure; HttpOnly; SameSite=Strict` session cookie, 3-second minimum fill time, Turnstile (when configured), allow-list validation of every field, control-character/null-byte stripping, 5 submissions per 10 min per IP, plain-text email with fixed `From` and validated `Reply-To` only, generic error messages |
| Forms (browser) | `script.js` | Same rules for instant feedback; all output via `textContent`; URL parameters can only select existing options |
| Privacy | `privacy.html`, consent box on every form | Kenya Data Protection Act 2019 notice and consent; no form data stored on the server; security logs hold only hashed IPs and are deleted after 90 days |
| Build guard | `src/build.py` | Build fails if a page gains an inline style, an inline event handler, or an inline script whose hash is not in the CSP |

## Private folder (outside the web root)

`send-contact.php` and `csp-report.php` create `../afstor-private/` next to the site folder
(e.g. `/home/zpnitnzt/afstor-private/`) for rate-limit state and logs. If the host forbids that,
they fall back to the system temp folder. Logs contain no names, emails, messages or raw IPs.

Optional settings file `../afstor-private/config.php` (never commit it):

```php
<?php
return [
    'turnstile_site_key'   => '0x4AAAA...',   // from Cloudflare Turnstile
    'turnstile_secret_key' => '0x4AAAA...',   // keep secret
    'ip_salt'              => 'a long random string',
];
```

Environment variables `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` and `AFSTOR_IP_SALT` override the file.

## Turning on the CAPTCHA (Cloudflare Turnstile)

1. In Cloudflare (free account) > Turnstile, add a widget for `afstor.co.ke` and `staging.afstor.co.ke`, mode **Managed** or **Invisible**.
2. Put the site key and secret key in `../afstor-private/config.php` as above.
3. That's all: no rebuild needed. The forms load Turnstile automatically and the server starts requiring a valid token.

## Enforcing the CSP (after about a week in Report-Only)

1. Read `../afstor-private/logs/csp-*.log`. Entries from browser extensions (`chrome-extension`, `moz-extension`) can be ignored.
2. If anything Afstor-owned is listed, fix it or add the source to the policy.
3. In `.htaccess`, change `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. Keep the policy text identical.
4. Deploy, then check: YouTube video (Blog), LinkedIn post (SOLCO article), map (Contact), hero animation, every form.

Adding a new third party (analytics, chat widget ...) means adding its domains to the policy first.

## If the site shows "500 Internal Server Error" after deploying

Some hosts disallow a directive in `.htaccess`. Rename `.htaccess` in cPanel File Manager to get the
site back, then remove the offending line (usually `Options`, `ServerSignature` or a `php_flag`) and
restore it. cPanel's Errors log names the line.

## Needs hosting or account access (not possible from the code)

- [ ] **Password-protect staging**: cPanel > Directory Privacy on the staging folder (or IP allow-list).
- [ ] **TLS**: confirm AutoSSL certificates for both domains; TLS 1.2 minimum, 1.3 preferred (cPanel/host).
- [ ] **Server header**: hide the server version (`ServerTokens Prod`), host-level setting.
- [ ] **2FA and strong unique passwords** on cPanel, GitHub, domain registrar, email and Cloudflare accounts; limit who has access.
- [ ] **cPanel login protection**: cPHulk brute-force protection (host).
- [ ] **Backups**: daily off-server backups of files and mailboxes (cPanel Backup / JetBackup); test a restore.
- [ ] **Monitoring**: uptime monitoring (e.g. UptimeRobot) and security alerts.
- [ ] **WAF**: consider Cloudflare in front of the site (DDoS protection, bot filtering, TLS).
- [ ] **Email retention**: enquiries live in the sales/office mailboxes. Apply the 24-month retention from the Privacy Policy there and restrict mailbox access.
- [ ] **Privacy Policy review**: confirm the retention period and wording with management or legal; consider registering with the ODPC if required.
- [ ] **HSTS preload**: only after HTTPS is confirmed on every afstor.co.ke subdomain.
- [ ] **Scans after deploy**: securityheaders.com, observatory.mozilla.org, ssllabs.com/ssltest.

## Google Analytics 4 (consent-based)

- **Where:** `analytics.js` (loaded in every page's `<head>`, deferred). The Measurement ID (`G-7QN08Y8K1L`) is the
  `MEASUREMENT_ID` line at the top. To change it, edit that line and redeploy; no rebuild needed.
- **When it loads:** only on `afstor.co.ke` / `www.afstor.co.ke` (never staging), only with a real ID,
  and only after the visitor clicks **Accept**. Consent Mode v2 defaults analytics_storage,
  ad_storage, ad_user_data and ad_personalization to `denied`; Accept updates analytics_storage to
  `granted`. Google signals and ad personalisation are off; cookies last about 13 months.
- **Choice:** stored in the browser for 12 months; "Cookie settings" in the footer (and in the
  Privacy Policy) reopens the banner. Declining removes the `_ga` cookies.
- **Events (no personal data):** `generate_lead` (`stakeholder_type`: household, distributor_partner,
  school_institution, development_org, investor_government, or other for the contact page's
  "Something else"), sent only after the server confirms the enquiry; `select_pathway`
  (`pathway_name`, `link_location`: hero_selector / who_we_serve_menu), queued and sent on the next
  page so the click isn't lost when the page unloads; `contact_click` (`method`: whatsapp / phone /
  email, `link_location`).
- **CSP:** adds only `https://www.googletagmanager.com` (script-src), the Google Analytics domains
  (connect-src) and `https://www.google-analytics.com https://www.googletagmanager.com` (img-src).
- **DebugView:** open any production page with `?ga_debug=1`, accept cookies, and watch
  GA4 > Admin > DebugView.
- **GA4 admin (manual):** set data retention to 14 months (Admin > Data settings > Data retention), to
  match the Privacy Policy; mark `generate_lead` as a key event; register `stakeholder_type`,
  `pathway_name`, `method` and `link_location` as custom dimensions so they show in reports.
