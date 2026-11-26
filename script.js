(() => {
  const root = document.documentElement;
  const header = document.querySelector('#site-header');
  const nav = document.querySelector('#site-nav');
  const menuToggle = document.querySelector('.menu-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktopNav = window.matchMedia('(min-width: 1100px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- Header state ---------- */
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile drawer ---------- */
  function setMenu(open) {
    if (!menuToggle || !nav) return;
    if (open && header) {
      root.style.setProperty('--drawer-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
    }
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  }
  desktopNav.addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- "Who we serve" mega menu ---------- */
  const megaTriggers = [...document.querySelectorAll('.nav-trigger')];
  let hoverTimer;

  function setMega(trigger, open) {
    trigger.setAttribute('aria-expanded', String(open));
  }
  function closeAllMega(except) {
    megaTriggers.forEach((t) => { if (t !== except) setMega(t, false); });
  }

  megaTriggers.forEach((trigger) => {
    const item = trigger.closest('.has-mega');
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      closeAllMega(trigger);
      setMega(trigger, open);
    });
    item.addEventListener('mouseenter', () => {
      if (!desktopNav.matches || !finePointer.matches) return;
      clearTimeout(hoverTimer);
      closeAllMega(trigger);
      setMega(trigger, true);
    });
    item.addEventListener('mouseleave', () => {
      if (!desktopNav.matches || !finePointer.matches) return;
      hoverTimer = setTimeout(() => setMega(trigger, false), 180);
    });
    item.addEventListener('focusout', (e) => {
      if (desktopNav.matches && !item.contains(e.relatedTarget)) setMega(trigger, false);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-mega')) closeAllMega();
    if (e.target.closest('.site-nav a')) setMenu(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openTrigger = megaTriggers.find((t) => t.getAttribute('aria-expanded') === 'true');
    if (openTrigger) {
      setMega(openTrigger, false);
      openTrigger.focus();
    } else if (menuToggle && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuToggle.focus();
    }
  });

  /* ---------- Hero rotating phrase ---------- */
  // Each phrase shows for ~3s, then a 0.6s slide-and-fade (CSS) to the next.
  // Stops for reduced-motion users and pauses while the tab is hidden.
  const heroRotator = document.querySelector('[data-hero-rotator]');
  if (heroRotator && !reduceMotion) {
    const phrases = [...heroRotator.querySelectorAll('.hero-phrase')];
    const HOLD = 3000;
    const SWAP = 600;
    let current = 0;
    let timer = null;

    const advance = () => {
      const leaving = phrases[current];
      current = (current + 1) % phrases.length;
      leaving.classList.remove('is-active');
      leaving.classList.add('is-leaving');
      phrases[current].classList.remove('is-leaving');
      phrases[current].classList.add('is-active');
      setTimeout(() => leaving.classList.remove('is-leaving'), SWAP);
      schedule();
    };
    const schedule = () => { timer = setTimeout(advance, HOLD + SWAP); };
    const stop = () => { clearTimeout(timer); timer = null; };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (!timer) schedule();
    });
    if (phrases.length > 1) schedule();
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      el.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(el), 4) * 0.08}s`);
      io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Sub-navigation scrollspy ---------- */
  const subLinks = [...document.querySelectorAll('.subnav a[href^="#"]')];
  if (subLinks.length && 'IntersectionObserver' in window) {
    const map = new Map();
    subLinks.forEach((a) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) map.set(target, a);
    });
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        subLinks.forEach((a) => a.classList.remove('is-active'));
        const link = map.get(entry.target);
        if (link) {
          link.classList.add('is-active');
          link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, section) => spy.observe(section));
  }

  /* ---------- Institutional savings estimate ---------- */
  document.querySelectorAll('[data-savings-calc]').forEach((calc) => {
    const input = calc.querySelector('input');
    const out = calc.querySelector('[data-calc-out]');
    const fmt = new Intl.NumberFormat('en-KE');
    const update = () => {
      const weekly = Math.min(100000000, Math.max(0, Number(input.value) || 0));
      out.textContent = `KES ${fmt.format(Math.round(weekly * 52))}`;
    };
    calc.addEventListener('submit', (e) => e.preventDefault());
    input.addEventListener('input', update);
    update();
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Enquiry forms ----------
     Client-side checks are only for a friendly experience; send-contact.php re-validates
     everything. User input is only ever written to the page with textContent. */
  const forms = [...document.querySelectorAll('[data-enquiry-form]')];
  const ENDPOINT = 'send-contact.php';
  const MIN_FILL_MS = 3200;

  const TEXT_RE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} &.,'’()/:+#%-]*$/u;
  const PLACE_RE = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} ,.'’()/-]*$/u;
  const RULES = {
    name: { re: /^[\p{L}\p{M}][\p{L}\p{M}' .’-]*$/u, msg: 'Use letters, spaces, hyphens or apostrophes only.' },
    organisation: { re: TEXT_RE, msg: 'Please remove unusual symbols.' },
    role: { re: TEXT_RE, msg: 'Please remove unusual symbols.' },
    current_reach: { re: TEXT_RE, msg: 'Please remove unusual symbols.' },
    county: { re: PLACE_RE, msg: 'Use letters and spaces only.' },
    geography: { re: PLACE_RE, msg: 'Use letters and spaces only.' }
  };

  /* Kenyan formats (07xx, 01xx, +254, 254) and international numbers. Mirrors the server rule. */
  function isValidPhone(value) {
    if (!/^\+?[0-9][0-9 -]{6,18}[0-9]$/.test(value)) return false;
    const digits = value.replace(/\D/g, '');
    if (value.startsWith('+')) {
      return digits.startsWith('254') ? /^254[17]\d{8}$/.test(digits) : digits.length >= 8 && digits.length <= 15;
    }
    if (digits.startsWith('0')) return /^0[17]\d{8}$/.test(digits);
    return /^254[17]\d{8}$/.test(digits);
  }

  const activeFields = (form) => [...form.querySelectorAll('input, select, textarea')]
    .filter((f) => f.type !== 'hidden' && f.name && f.name !== 'website' && !f.matches(':disabled'));

  function validateField(field) {
    const isBox = field.type === 'checkbox';
    const value = isBox ? '' : field.value.trim();
    const rule = RULES[field.name];
    let message = '';
    if (isBox) {
      if (field.required && !field.checked) message = 'Please tick this box so we can respond to your enquiry.';
    } else if (field.required && !value) {
      message = 'This field is required.';
    } else if (value && field.maxLength > 0 && value.length > field.maxLength) {
      message = `Please use no more than ${field.maxLength} characters.`;
    } else if (field.name === 'name' && value.length < 2) {
      message = 'Enter a name with at least 2 characters.';
    } else if (field.name === 'email' && value && !/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/.test(value)) {
      message = 'Enter a valid email address.';
    } else if (field.name === 'phone' && value && !isValidPhone(value)) {
      message = 'Enter a valid phone number, e.g. 0712 345 678 or +254 712 345 678.';
    } else if (field.type === 'number' && value && (!/^\d+$/.test(value) || Number(value) < Number(field.min || 0) || Number(value) > Number(field.max || Infinity))) {
      message = 'Enter a whole number.';
    } else if (rule && value && !rule.re.test(value)) {
      message = rule.msg;
    } else if (field.tagName === 'SELECT' && value && ![...field.options].some((o) => o.value === field.value)) {
      message = 'Choose one of the listed options.';
    } else if (field.name === 'message' && field.required && value.length < 10) {
      message = 'Please tell us a little more (at least 10 characters).';
    }
    field.setAttribute('aria-invalid', String(Boolean(message)));
    const error = field.id && document.getElementById(`${field.id}-error`);
    if (error) error.textContent = message;
    return !message;
  }

  function clearErrors(form) {
    form.querySelectorAll('[aria-invalid]').forEach((f) => f.setAttribute('aria-invalid', 'false'));
    form.querySelectorAll('.field-error').forEach((e) => { e.textContent = ''; });
  }

  function setupSegmented(form) {
    const select = form.querySelector('select[name="audience"]');
    const groups = [...form.querySelectorAll('[data-audience-fields]')];
    const message = form.querySelector('textarea[name="message"]');
    const optionalTag = form.querySelector('[data-message-optional]');
    const messageRequiredFor = ['support', 'general'];

    const apply = () => {
      groups.forEach((group) => {
        const on = group.dataset.audienceFields === select.value;
        group.hidden = !on;
        group.disabled = !on;
      });
      const needsMessage = messageRequiredFor.includes(select.value);
      if (message) message.required = needsMessage;
      if (optionalTag) optionalTag.hidden = needsMessage;
    };

    /* ?audience= can only pick one of the existing options; it is never written into the page. */
    const requested = new URLSearchParams(window.location.search).get('audience');
    if (requested && [...select.options].some((o) => o.value === requested)) select.value = requested;
    select.addEventListener('change', apply);
    apply();
  }

  /* CSRF token (and optional Cloudflare Turnstile site key) for this browser session. */
  const session = { token: '', siteKey: '', loadedAt: 0 };
  function loadToken() {
    return fetch(`${ENDPOINT}?action=token`, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('token'))))
      .then((data) => {
        session.token = typeof data.token === 'string' ? data.token : '';
        session.siteKey = typeof data.turnstile_site_key === 'string' ? data.turnstile_site_key : '';
        session.loadedAt = Date.now();
        if (session.siteKey) setupTurnstile();
      })
      .catch(() => { session.token = ''; });
  }

  /* Cloudflare Turnstile: only loaded once a site key is configured on the server. */
  const widgets = new Map();
  function setupTurnstile() {
    const render = () => forms.forEach((form) => {
      const slot = form.querySelector('[data-turnstile]');
      if (!slot || widgets.has(form) || !window.turnstile) return;
      widgets.set(form, window.turnstile.render(slot, { sitekey: session.siteKey, appearance: 'interaction-only', action: 'enquiry' }));
    });
    if (window.turnstile) { render(); return; }
    if (document.querySelector('script[data-turnstile-api]')) return;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.dataset.turnstileApi = '';
    script.addEventListener('load', render);
    document.head.appendChild(script);
  }
  const turnstileToken = (form) => (widgets.has(form) && window.turnstile ? window.turnstile.getResponse(widgets.get(form)) || '' : '');
  const resetTurnstile = (form) => { if (widgets.has(form) && window.turnstile) window.turnstile.reset(widgets.get(form)); };

  const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

  async function postEnquiry(form) {
    const payload = Object.fromEntries(new FormData(form));
    delete payload['cf-turnstile-response']; // Turnstile's own hidden input; we send it under our field name
    payload.csrf_token = session.token;
    const captcha = turnstileToken(form);
    if (captcha) payload.cf_turnstile_response = captcha;
    const response = await fetch(form.action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('We could not send your enquiry right now. Please call or WhatsApp us on +254 181 100 200.');
    }
    return { response, result };
  }

  if (forms.length) loadToken();

  forms.forEach((form) => {
    if (form.hasAttribute('data-segmented')) setupSegmented(form);

    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target);
    });
    form.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') validateField(e.target);
    });
    form.addEventListener('focusout', (e) => {
      if (e.target.matches('input, select, textarea') && e.target.type !== 'checkbox' && e.target.value.trim()) validateField(e.target);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const success = form.querySelector('[data-form-success]');
      const failure = form.querySelector('[data-form-error]');
      const button = form.querySelector('button[type="submit"]');
      const fields = activeFields(form);
      const valid = fields.map(validateField).every(Boolean);
      if (success) success.textContent = '';
      if (failure) failure.textContent = '';

      if (!valid) {
        const first = fields.find((f) => f.getAttribute('aria-invalid') === 'true');
        if (first) first.focus();
        return;
      }

      const label = button.textContent;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Sending…';

      try {
        if (!session.token) await loadToken();
        const early = MIN_FILL_MS - (Date.now() - session.loadedAt);
        if (early > 0) await wait(early);

        let { response, result } = await postEnquiry(form);
        if (!result.ok && (result.code === 'token' || result.code === 'too_fast')) {
          /* Session expired (e.g. the page was left open for hours): fresh token, retry once. */
          await loadToken();
          await wait(MIN_FILL_MS);
          ({ response, result } = await postEnquiry(form));
        }
        if (!response.ok || !result.ok) throw new Error(result.message || 'We could not send your enquiry. Please try again.');

        if (typeof result.token === 'string' && result.token) session.token = result.token;
        const name = (form.querySelector('[name="name"]')?.value || '').trim().split(' ')[0];
        if (success) success.textContent = `Thank you${name ? `, ${name}` : ''}. ${result.message}`;
        form.reset();
        clearErrors(form);
        if (form.hasAttribute('data-segmented')) form.querySelector('select[name="audience"]').dispatchEvent(new Event('change'));
      } catch (error) {
        if (failure) {
          failure.textContent = error instanceof Error && error.message && error.message !== 'token'
            ? error.message
            : 'We could not send your enquiry. Please try again, or call or WhatsApp us on +254 181 100 200.';
        }
      } finally {
        resetTurnstile(form);
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = label;
      }
    });
  });

  /* Share buttons: share the URL the reader is actually on (falls back to the static href) */
  const shareTargets = {
    linkedin: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    x: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    whatsapp: (u, t) => `https://wa.me/?text=${t}%20${u}`,
    facebook: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`
  };
  if (/^https?:$/.test(window.location.protocol)) {
    const url = encodeURIComponent(window.location.href.split('#')[0]);
    const title = encodeURIComponent(document.querySelector('h1')?.textContent.trim() || document.title);
    document.querySelectorAll('[data-share]').forEach((a) => {
      const build = shareTargets[a.dataset.share];
      if (build) a.href = build(url, title);
    });
  }

  /* Links such as "Start with a deposit" pre-select an option in the page's form */
  document.querySelectorAll('[data-prefill]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = document.querySelector(link.getAttribute('href'));
      const form = target && (target.matches('form') ? target : target.querySelector('form'));
      if (!form) return;
      const [name, value] = link.dataset.prefill.split('=');
      const field = form.querySelector(`[name="${name}"]`);
      if (field) field.value = value;
    });
  });
})();
