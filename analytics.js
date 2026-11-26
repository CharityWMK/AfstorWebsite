/*
 * Afstor analytics: Google Analytics 4 with Google Consent Mode v2.
 *
 * - Consent defaults to "denied" for analytics and all advertising signals.
 * - gtag.js is loaded ONLY when all three are true:
 *     1. the page is on the production site (afstor.co.ke / www.afstor.co.ke), never staging;
 *     2. a real Measurement ID is set below (a placeholder such as G-XXXXXXXXXX keeps it off);
 *     3. the visitor clicked "Accept" in the cookie banner.
 * - The visitor's choice is remembered for 12 months and can be changed via "Cookie settings".
 * - Events carry no personal data: never names, emails, phone numbers or message text.
 * - Add ?ga_debug=1 to a production URL to see hits in GA4 DebugView.
 */
(() => {
  const MEASUREMENT_ID = 'G-7QN08Y8K1L'; // GA4 property for afstor.co.ke
  const PRODUCTION_HOSTS = ['www.afstor.co.ke', 'afstor.co.ke'];
  const STORAGE_KEY = 'afstor_cookie_consent';
  const CHOICE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

  const idConfigured = /^G-[A-Z0-9]{4,}$/.test(MEASUREMENT_ID) && !/^G-X+$/.test(MEASUREMENT_ID);
  const isProduction = PRODUCTION_HOSTS.includes(window.location.hostname);
  const enabled = idConfigured && isProduction;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); } // eslint-disable-line prefer-rest-params
  window.gtag = window.gtag || gtag;

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  let loaded = false;
  let choice = readChoice();

  function readChoice() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && (saved.value === 'granted' || saved.value === 'denied') && Date.now() - saved.at < CHOICE_TTL_MS) return saved.value;
    } catch { /* storage blocked: ask again */ }
    return null;
  }

  function saveChoice(value) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, at: Date.now() })); } catch { /* ignore */ }
  }

  function loadGoogleTag() {
    if (!enabled || loaded) return;
    loaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(script);
    window.gtag('js', new Date());
    const config = {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 60 * 60 * 24 * 395 // about 13 months
    };
    if (new URLSearchParams(window.location.search).get('ga_debug') === '1') config.debug_mode = true;
    window.gtag('config', MEASUREMENT_ID, config);
    flushPending();
  }

  function deleteAnalyticsCookies() {
    const host = window.location.hostname;
    const domains = ['', host, `.${host.replace(/^www\./, '')}`];
    document.cookie.split(';').map((c) => c.split('=')[0].trim())
      .filter((name) => name === '_ga' || name.startsWith('_ga_'))
      .forEach((name) => domains.forEach((d) => {
        document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}; SameSite=Lax`;
      }));
  }

  function applyChoice(value) {
    choice = value;
    saveChoice(value);
    window.gtag('consent', 'update', { analytics_storage: value });
    if (value === 'granted') loadGoogleTag();
    else deleteAnalyticsCookies();
  }

  const isActive = () => enabled && loaded && choice === 'granted';

  /* Events from links that leave the page (e.g. a pathway click) would be lost when the page
     unloads, so they wait in sessionStorage and are sent once Google loads on the next page. */
  const PENDING_KEY = 'afstor_pending_events';
  const QUEUEABLE = ['select_pathway'];

  function queueForNextPage(name, params) {
    if (!isActive()) return;
    try {
      const list = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || '[]');
      list.push({ name, params, at: Date.now() });
      window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-5)));
    } catch {
      track(name, params);
    }
  }

  function flushPending() {
    let list = [];
    try {
      list = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || '[]');
      window.sessionStorage.removeItem(PENDING_KEY);
    } catch { return; }
    if (!Array.isArray(list)) return;
    list.filter((e) => e && QUEUEABLE.includes(e.name) && Date.now() - e.at < 60000 && e.params && typeof e.params === 'object')
      .forEach((e) => track(e.name, { pathway_name: String(e.params.pathway_name || ''), link_location: String(e.params.link_location || '') }));
  }

  /** Sends an event only when analytics is active. Callers must never pass personal data. */
  function track(name, params = {}) {
    if (!isActive()) return;
    window.gtag('event', name, params);
  }

  window.afstorAnalytics = { track, enabled, choice: () => choice };

  if (choice === 'granted') applyChoice('granted');

  /* ---------- Cookie banner ---------- */
  function setupBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    const show = () => { banner.hidden = false; document.body.classList.add('has-cookie-banner'); };
    const hide = () => { banner.hidden = true; document.body.classList.remove('has-cookie-banner'); };

    banner.querySelectorAll('[data-consent]').forEach((button) => {
      button.addEventListener('click', () => {
        applyChoice(button.dataset.consent === 'granted' ? 'granted' : 'denied');
        hide();
      });
    });
    document.querySelectorAll('[data-cookie-settings]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        show();
        const current = banner.querySelector(`[data-consent="${choice === 'granted' ? 'granted' : 'denied'}"]`);
        if (current) current.focus();
      });
    });
    if (!choice) show();
  }

  /* ---------- Pathway and contact-link events (no personal data) ---------- */
  const PATHWAYS = {
    'households.html': 'household',
    'distributors.html': 'distributor_partner',
    'institutions.html': 'school_institution',
    'development-partners.html': 'development_org',
    'investors.html': 'investor_government'
  };

  function linkLocation(el) {
    if (el.closest('.utility-bar')) return 'top_bar';
    if (el.closest('.site-header')) return 'header';
    if (el.closest('.mobile-actions')) return 'mobile_bar';
    if (el.closest('.whatsapp-float')) return 'floating_button';
    if (el.closest('.site-footer')) return 'footer';
    return 'page';
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';

    if (link.matches('.pathway-card, .mega-item')) {
      const pathway = PATHWAYS[href.split(/[?#]/)[0]];
      if (!pathway) return;
      const params = { pathway_name: pathway, link_location: link.matches('.pathway-card') ? 'hero_selector' : 'who_we_serve_menu' };
      const newTab = event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0 || link.target === '_blank';
      if (newTab || event.defaultPrevented) track('select_pathway', params);
      else queueForNextPage('select_pathway', params); // this page is about to unload
      return;
    }

    let method = '';
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href) && !link.matches('[data-share]')) method = 'whatsapp';
    else if (/^tel:/i.test(href)) method = 'phone';
    else if (/^mailto:/i.test(href)) method = 'email';
    if (method) track('contact_click', { method, link_location: linkLocation(link) });
  }, { capture: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupBanner);
  else setupBanner();
})();
