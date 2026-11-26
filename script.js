const header = document.querySelector('#site-header');
const utilityBar = document.querySelector('.utility-bar');
const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-navigation');
const navLinks = [...document.querySelectorAll('.nav-link')];
const sections = [...document.querySelectorAll('main section')];
const heroSlides = [...document.querySelectorAll('.hero-slide')];
const heroDots = [...document.querySelectorAll('.hero-dot')];
const typingWord = document.querySelector('#typewriter-word');
const contactForm = document.querySelector('#contact-form');
const contactFields = contactForm
  ? [...contactForm.querySelectorAll('input, select, textarea')].filter((field) => field.name !== 'website')
  : [];
const revealElements = [...document.querySelectorAll('.reveal')];
const words = ['MATTERS', 'LASTS', 'COUNTS', 'LEADS'];
let activeSlide = 0;
let wordIndex = 0;
let typingIndex = 0;
let isDeleting = false;

function closeMenu() {
  if (!menuToggle || !navigation) return;

  menuToggle.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}

function updateActiveLink() {
  const headerOffset = (header ? header.offsetHeight : 0) + (utilityBar ? utilityBar.offsetHeight : 0);
  const marker = window.scrollY + headerOffset + 4;
  let currentSection = sections[0];

  sections.forEach((section) => {
    if (section.offsetTop <= marker) currentSection = section;
  });

  navLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${currentSection.id}`;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
}

function showSlide(index) {
  activeSlide = index;

  heroSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle('hero-slide-active', slideIndex === activeSlide);
  });

  heroDots.forEach((dot, dotIndex) => {
    const isActive = dotIndex === activeSlide;
    dot.classList.toggle('hero-dot-active', isActive);
    dot.setAttribute('aria-selected', String(isActive));
  });
}

function typeNextWord() {
  if (!typingWord) return;

  const currentWord = words[wordIndex];
  typingIndex += isDeleting ? -1 : 1;
  typingWord.textContent = currentWord.slice(0, typingIndex);

  let delay = isDeleting ? 70 : 120;
  if (!isDeleting && typingIndex === currentWord.length) {
    isDeleting = true;
    delay = 1800;
  } else if (isDeleting && typingIndex === 0) {
    isDeleting = false;
    wordIndex = (wordIndex + 1) % words.length;
    delay = 400;
  }

  window.setTimeout(typeNextWord, delay);
}

function validateContactField(field) {
  const value = field.value.trim();
  let message = '';

  if (field.required && !value) {
    message = 'This field is required.';
  } else if (field.name === 'name' && value && value.length < 2) {
    message = 'Enter a name with at least 2 characters.';
  } else if (field.name === 'email' && value && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
    message = 'Enter a valid email address.';
  } else if (field.name === 'phone' && value && !/^[0-9+\-\s().]{7,40}$/.test(value)) {
    message = 'Enter a valid phone number.';
  } else if (value.length > Number(field.maxLength) && field.maxLength > 0) {
    message = `Use no more than ${field.maxLength} characters.`;
  } else if (field.name === 'message' && value.length < 10) {
    message = 'Please describe your requirements in at least 10 characters.';
  }

  const error = document.querySelector(`#${field.id}-error`);
  field.setAttribute('aria-invalid', String(Boolean(message)));
  if (error) error.textContent = message;
  return !message;
}

if (contactForm) {
  const formSuccess = document.querySelector('#form-success');
  const formError = document.querySelector('#form-error');
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const submitLabel = submitButton.textContent;

  contactFields.forEach((field) => {
    field.addEventListener('blur', () => validateContactField(field));
    field.addEventListener('input', () => validateContactField(field));
    field.addEventListener('change', () => validateContactField(field));
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fieldsAreValid = contactFields.map(validateContactField).every(Boolean);

    if (!fieldsAreValid) {
      if (formSuccess) formSuccess.textContent = '';
      contactFields.find((field) => field.getAttribute('aria-invalid') === 'true')?.focus();
      return;
    }

    if (formSuccess) formSuccess.textContent = '';
    if (formError) formError.textContent = '';
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Sending...';

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(contactForm)))
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('The server returned an unexpected response. Please try again later.');
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'We could not send your inquiry. Please try again.');
      }

      const name = contactFields.find((field) => field.name === 'name').value.trim();
      if (formSuccess) formSuccess.textContent = `Thank you, ${name}. Your inquiry has been sent.`;
      contactForm.reset();
      contactFields.forEach((field) => {
        field.setAttribute('aria-invalid', 'false');
        const error = document.querySelector(`#${field.id}-error`);
        if (error) error.textContent = '';
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'We could not send your inquiry. Please try again.';
      if (formError) formError.textContent = message;
      console.error('Contact form submission failed:', error);
    } finally {
      submitButton.disabled = false;
      submitButton.setAttribute('aria-busy', 'false');
      submitButton.textContent = submitLabel;
    }
  });
}

if ('IntersectionObserver' in window && revealElements.length) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-visible', entry.isIntersecting);
    });
  }, { threshold: 0.15 });

  revealElements.forEach((element, index) => {
    element.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 0.1}s`);
    revealObserver.observe(element);
  });
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}

if (menuToggle && navigation) {
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    navigation.classList.toggle('is-open', !isOpen);
  });

  document.addEventListener('click', (event) => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    const clickedMenu = navigation.contains(event.target) || menuToggle.contains(event.target);
    if (isOpen && !clickedMenu) closeMenu();
  });
}

navLinks.forEach((link) => link.addEventListener('click', closeMenu));
heroDots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));
window.addEventListener('scroll', updateActiveLink, { passive: true });
window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) closeMenu();
  updateActiveLink();
});
if (heroSlides.length > 1) window.setInterval(() => showSlide((activeSlide + 1) % heroSlides.length), 5000);
if (typingWord) typeNextWord();
updateActiveLink();