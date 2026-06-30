// ── LOADER ──
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 1400);
});

// ── CURSOR GLOW ──
const cursorGlow = document.getElementById('cursor-glow');
let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice && cursorGlow) cursorGlow.style.display = 'none';
if (!isTouchDevice) {
  document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  function animateCursor() {
    glowX += (mouseX - glowX) * 0.08;
    glowY += (mouseY - glowY) * 0.08;
    cursorGlow.style.left = glowX + 'px';
    cursorGlow.style.top = glowY + 'px';
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
}

// ── NAVBAR ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ── HAMBURGER ──
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});
document.querySelectorAll('.mobile-link, .mobile-btns a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
  });
});

// ── PARTICLES ──
const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = -Math.random() * 0.6 - 0.2;
    this.alpha = Math.random() * 0.6 + 0.1;
    this.decay = Math.random() * 0.003 + 0.001;
    const r = Math.random();
    this.color = r < 0.33 ? [255,122,24] : r < 0.66 ? [245,158,11] : [255,213,79];
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.alpha -= this.decay;
    if (this.alpha <= 0 || this.y < -10) this.reset();
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color.join(',')},${this.alpha})`;
    ctx.fill();
  }
}

for (let i = 0; i < 80; i++) {
  const p = new Particle();
  p.y = Math.random() * canvas.height;
  particles.push(p);
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}
animateParticles();

// ── SCROLL REVEAL ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => revealObserver.observe(el));

// ── ANIMATED COUNTERS ──
function animateCounter(el, target, duration = 1800) {
  let start = null;
  const isLarge = target >= 1000;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    if (isLarge) {
      el.textContent = (current / 1000).toFixed(0) + 'K';
      if (target >= 100000) el.textContent = (current / 100000).toFixed(1) + 'L';
    } else {
      el.textContent = current;
    }
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = isLarge ? (target >= 100000 ? (target/100000).toFixed(1) + 'L' : (target/1000).toFixed(0) + 'K') : target;
  };
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.dataset.target);
      animateCounter(el, target);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

// ── FAQ ACCORDION ──
function toggleFaq(el) {
  const item = el.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ── RIPPLE EFFECT ──
document.querySelectorAll('.ripple-container').forEach(btn => {
  btn.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-wave';
    ripple.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(rect.width,rect.height)*2}px;height:${Math.max(rect.width,rect.height)*2}px;margin-left:-${Math.max(rect.width,rect.height)}px;margin-top:-${Math.max(rect.width,rect.height)}px;`;
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
});

// ── COPY REFERRAL CODE ──
function copyCode(btn) {
  const code = btn.parentElement.querySelector('.ref-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    btn.style.background = 'rgba(82,196,26,0.2)';
    btn.style.color = '#52C41A';
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
}

// ── TAB BUTTONS ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

// ── TESTIMONIALS CAROUSEL DUPLICATE ──
const testimonialsTrack = document.getElementById('testimonials-track');
if (testimonialsTrack) {
  const cards = testimonialsTrack.querySelectorAll('.testimonial-card');
  cards.forEach(c => {
    const clone = c.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    testimonialsTrack.appendChild(clone);
  });
}

// ── SMOOTH ACTIVE NAV ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? 'var(--blaze)' : '';
  });
});

// ── COUNTDOWN TIMER ──
function startCountdown(targetMinutes, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let totalSeconds = targetMinutes * 60;
  function tick() {
    if (totalSeconds <= 0) totalSeconds = 25 * 60;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    el.textContent = m + ':' + String(s).padStart(2, '0');
    totalSeconds--;
  }
  tick();
  setInterval(tick, 1000);
}
startCountdown(23, 'hero-countdown');

// ── WALLET AMOUNT COUNTER ──
function animateWalletValue(el, target) {
  const numTarget = parseFloat(String(target).replace(/[^0-9.]/g, ''));
  let start = null;
  const duration = 1500;
  function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const current = Math.floor(eased * numTarget);
    if (numTarget >= 1000) {
      el.textContent = '₹' + current.toLocaleString('en-IN') + '.00';
    } else {
      el.textContent = current;
    }
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const walletObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = el.textContent.trim();
      animateWalletValue(el, target);
      walletObserver.unobserve(el);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.wallet-amount').forEach(el => walletObserver.observe(el));

// ── TOAST SYSTEM ──
function showToast(message, type) {
  const container = document.querySelector('.toast-container') || (() => {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span class="toast-icon"><i class="fa-solid fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle') + '"></i></span> ' + message;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3200);
}

// ── CONTACT FORM ──
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const inputs = this.querySelectorAll('.form-input');
    let valid = true;
    inputs.forEach(inp => {
      if (!inp.value.trim()) {
        inp.style.borderColor = 'rgba(255,77,79,0.5)';
        valid = false;
      } else {
        inp.style.borderColor = '';
      }
    });
    if (!valid) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    const btn = this.querySelector('.btn-primary');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    setTimeout(() => {
      showToast('Message sent! We will get back to you within 4 hours.', 'success');
      btn.disabled = false;
      btn.innerHTML = 'Send Message →';
      this.querySelectorAll('.form-input').forEach(i => i.value = '');
    }, 1200);
  });
}
