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
const contactFields = contactForm ? [...contactForm.querySelectorAll('input, textarea')] : [];
const revealElements = [...document.querySelectorAll('.reveal')];
const productSlider = document.querySelector('#product-slider');
const productSlides = productSlider ? [...productSlider.querySelectorAll('.product-slide')] : [];
const productTrack = productSlider ? productSlider.querySelector('.product-track') : null;
const productDots = productSlider ? [...document.querySelectorAll('.product-dot')] : [];
const productPrevious = productSlider ? productSlider.querySelector('.product-arrow-prev') : null;
const productNext = productSlider ? productSlider.querySelector('.product-arrow-next') : null;
const unsafeInputPattern = /<|>|javascript\s*:|on\w+\s*=/i;
const words = ['MATTERS', 'LASTS', 'COUNTS', 'LEADS'];
let activeSlide = 0;
let wordIndex = 0;
let typingIndex = 0;
let isDeleting = false;
let activeProduct = 0;
let productAutoTimer;
let productPauseTimer;
let productWrapPending = false;
let touchStartX = 0;

function closeMenu() {
  if (!menuToggle || !navigation) return;

  menuToggle.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}

function scrollToSection(event) {
  const targetId = event.currentTarget.getAttribute('href');
  const target = document.querySelector(targetId);

  if (!target || !header) return;

  event.preventDefault();
  const headerOffset = header.offsetHeight + (utilityBar ? utilityBar.offsetHeight : 0);
  const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;

  window.scrollTo({
    top: targetTop,
    behavior: 'smooth'
  });

  closeMenu();
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

function showProduct(index) {
  if (!productSlides.length) return;

  activeProduct = (index + productSlides.length) % productSlides.length;
  const isNextWrap = index >= productSlides.length;
  const isPreviousWrap = index < 0;
  const trackIndex = isNextWrap ? productSlides.length + 1 : isPreviousWrap ? 0 : activeProduct + 1;
  productWrapPending = isNextWrap || isPreviousWrap;
  productTrack.style.transition = 'transform 0.5s ease';
  productTrack.style.transform = `translateX(-${trackIndex * 100}%)`;
  productSlides.forEach((slide, slideIndex) => {
    const isActive = slideIndex === activeProduct;
    slide.classList.toggle('product-slide-active', isActive);
    slide.setAttribute('aria-hidden', String(!isActive));
  });
  productDots.forEach((dot, dotIndex) => {
    const isActive = dotIndex === activeProduct;
    dot.classList.toggle('product-dot-active', isActive);
    dot.setAttribute('aria-selected', String(isActive));
  });
}

function startProductAutoAdvance() {
  window.clearInterval(productAutoTimer);
  productAutoTimer = window.setInterval(() => showProduct(activeProduct + 1), 4000);
}

function pauseAfterProductInteraction() {
  window.clearInterval(productAutoTimer);
  window.clearTimeout(productPauseTimer);
  productPauseTimer = window.setTimeout(startProductAutoAdvance, 30000);
}

function handleProductNavigation(navigate) {
  navigate();
  pauseAfterProductInteraction();
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

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function validateContactField(field) {
  const value = field.value.trim();
  let message = '';

  if (!value) {
    message = 'This field is required.';
  } else if (unsafeInputPattern.test(value)) {
    message = 'Please remove HTML or executable content.';
  } else if (field.name === 'name' && !/^[A-Za-z\s\-']{2,50}$/.test(value)) {
    message = 'Use 2-50 letters, spaces, hyphens, or apostrophes.';
  } else if (field.name === 'email' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
    message = 'Enter a valid email address.';
  } else if (field.name === 'phone' && !/^[0-9+\-\s()]{7,20}$/.test(value)) {
    message = 'Enter a valid phone number.';
  } else if (field.name === 'subject' && (value.length < 5 || value.length > 100)) {
    message = 'Subject must be 5-100 characters.';
  } else if (field.name === 'message' && value.length > 1000) {
    message = 'Keep your message under 1000 characters.';
  }

  const error = document.querySelector(`#${field.id}-error`);
  field.setAttribute('aria-invalid', String(Boolean(message)));
  if (error) error.textContent = message;
  return !message;
}

if (contactForm) {
  contactFields.forEach((field) => {
    field.addEventListener('blur', () => validateContactField(field));
    field.addEventListener('input', () => validateContactField(field));
  });

  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const fieldsAreValid = contactFields.map(validateContactField).every(Boolean);
    const success = document.querySelector('#form-success');

    if (!fieldsAreValid) {
      if (success) success.textContent = '';
      return;
    }

    const safeValues = Object.fromEntries(contactFields.map((field) => [field.name, escapeHtml(field.value.trim())]));
    // TODO: connect to backend/email service. Server-side validation and sanitization is required too.
    if (success) success.textContent = `Thanks, ${safeValues.name}! We'll be in touch soon.`;
    contactForm.reset();
    contactFields.forEach((field) => field.setAttribute('aria-invalid', 'false'));
  });
}

if (productSlider && productSlides.length) {
  const firstClone = productSlides[0].cloneNode(true);
  const lastClone = productSlides[productSlides.length - 1].cloneNode(true);
  firstClone.classList.remove('product-slide-active');
  lastClone.classList.remove('product-slide-active');
  firstClone.setAttribute('aria-hidden', 'true');
  lastClone.setAttribute('aria-hidden', 'true');
  productTrack.append(firstClone);
  productTrack.prepend(lastClone);
  productTrack.addEventListener('transitionend', (event) => {
    if (event.target !== productTrack || event.propertyName !== 'transform' || !productWrapPending) return;

    productWrapPending = false;
    productTrack.style.transition = 'none';
    productTrack.style.transform = `translateX(-${(activeProduct + 1) * 100}%)`;
    productTrack.offsetHeight;
    productTrack.style.transition = 'transform 0.5s ease';
  });
  showProduct(0);
  productPrevious.addEventListener('click', () => handleProductNavigation(() => showProduct(activeProduct - 1)));
  productNext.addEventListener('click', () => handleProductNavigation(() => showProduct(activeProduct + 1)));
  productDots.forEach((dot, index) => dot.addEventListener('click', () => handleProductNavigation(() => showProduct(index))));
  productSlider.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleProductNavigation(() => showProduct(activeProduct - 1));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleProductNavigation(() => showProduct(activeProduct + 1));
    }
  });
  productSlider.addEventListener('pointerdown', (event) => {
    touchStartX = event.clientX;
    productSlider.setPointerCapture(event.pointerId);
  });
  productSlider.addEventListener('pointerup', (event) => {
    const distance = event.clientX - touchStartX;
    if (Math.abs(distance) >= 40) {
      handleProductNavigation(() => showProduct(activeProduct + (distance < 0 ? 1 : -1)));
    }
  });
  startProductAutoAdvance();
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

navLinks.forEach((link) => link.addEventListener('click', scrollToSection));
heroDots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));
window.addEventListener('scroll', updateActiveLink, { passive: true });
window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) closeMenu();
  updateActiveLink();
});
if (heroSlides.length > 1) window.setInterval(() => showSlide((activeSlide + 1) % heroSlides.length), 5000);
if (typingWord) typeNextWord();
updateActiveLink();