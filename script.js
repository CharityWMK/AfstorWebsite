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

  /* ---------- Hero rotating word ---------- */
  const rotator = document.querySelector('[data-rotate]');
  if (rotator && !reduceMotion) {
    const words = rotator.dataset.rotate.split('|');
    const word = rotator.querySelector('.rotator-word');
    let index = 0;
    setInterval(() => {
      word.classList.add('is-out');
      setTimeout(() => {
        index = (index + 1) % words.length;
        word.textContent = words[index];
        word.classList.remove('is-out');
      }, 350);
    }, 2800);
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
      const weekly = Math.max(0, Number(input.value) || 0);
      out.textContent = `KES ${fmt.format(Math.round(weekly * 52))}`;
    };
    input.addEventListener('input', update);
    update();
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Enquiry forms ---------- */
  const forms = [...document.querySelectorAll('[data-enquiry-form]')];

  const activeFields = (form) => [...form.querySelectorAll('input, select, textarea')]
    .filter((f) => f.type !== 'hidden' && f.name !== 'website' && !f.matches(':disabled'));

  function validateField(field) {
    const value = field.value.trim();
    let message = '';
    if (field.required && !value) {
      message = 'This field is required.';
    } else if (field.name === 'name' && value.length < 2) {
      message = 'Enter a name with at least 2 characters.';
    } else if (field.name === 'email' && value && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
      message = 'Enter a valid email address.';
    } else if (field.name === 'phone' && value && !/^[0-9+\-\s().]{7,40}$/.test(value)) {
      message = 'Enter a valid phone number.';
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

    const requested = new URLSearchParams(window.location.search).get('audience');
    if (requested && [...select.options].some((o) => o.value === requested)) select.value = requested;
    select.addEventListener('change', apply);
    apply();
  }

  forms.forEach((form) => {
    if (form.hasAttribute('data-segmented')) setupSegmented(form);

    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target);
    });
    form.addEventListener('focusout', (e) => {
      if (e.target.matches('input, select, textarea') && e.target.value.trim()) validateField(e.target);
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
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(form)))
        });
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error('The server returned an unexpected response. Please call or WhatsApp us instead.');
        }
        if (!response.ok || !result.ok) throw new Error(result.message || 'We could not send your enquiry. Please try again.');

        const name = (form.querySelector('[name="name"]')?.value || '').trim().split(' ')[0];
        if (success) success.textContent = `Thank you${name ? `, ${name}` : ''}. ${result.message}`;
        form.reset();
        clearErrors(form);
        if (form.hasAttribute('data-segmented')) form.querySelector('select[name="audience"]').dispatchEvent(new Event('change'));
      } catch (error) {
        if (failure) failure.textContent = error instanceof Error ? error.message : 'We could not send your enquiry. Please try again.';
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = label;
      }
    });
  });

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
