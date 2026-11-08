const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fills the top hairline in proportion to how far the page is scrolled. */
function initProgressBar() {
  const bar = document.querySelector('.progress');
  if (!bar) return;

  const update = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    bar.style.width = scrollable > 0 ? `${(doc.scrollTop / scrollable) * 100}%` : '0%';
  };

  addEventListener('scroll', update, { passive: true });
  update();
}

/** Fades elements in as they enter the viewport, once each. */
function initReveals() {
  const targets = document.querySelectorAll('.reveal, .section__head');
  if (prefersReducedMotion) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );

  targets.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 3, 2) * 80}ms`;
    observer.observe(el);
  });
}

/** Counts each statistic up from zero the first time it is seen. */
function initCounters() {
  const values = document.querySelectorAll('.stat__value');
  if (!values.length || prefersReducedMotion) return;

  const DURATION = 1400;

  const animate = (el) => {
    const target = Number(el.dataset.countTo);
    const prefix = el.dataset.prefix ?? '';
    const suffix = el.dataset.suffix ?? '';
    const start = performance.now();

    const frame = (now) => {
      const progress = Math.min((now - start) / DURATION, 1);
      const eased = 1 - (1 - progress) ** 3;
      el.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        animate(entry.target);
      }
    },
    { threshold: 0.4 }
  );

  values.forEach((el) => observer.observe(el));
}

/** Marks the one nav link matching the section under the reading line. */
function initScrollSpy() {
  const links = [...document.querySelectorAll('.nav__links a[href^="#"]')]
    .filter((a) => a.hash.length > 1);
  const sections = links.map((a) => document.querySelector(a.hash));
  if (!sections.some(Boolean)) return;

  let queued = false;

  const update = () => {
    queued = false;
    const readingLine = scrollY + innerHeight * 0.35;
    let current = -1;
    sections.forEach((section, i) => {
      if (section && section.offsetTop <= readingLine) current = i;
    });
    links.forEach((link, i) => link.classList.toggle('is-current', i === current));
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });
  update();
}

initProgressBar();
initReveals();
initCounters();
initScrollSpy();
