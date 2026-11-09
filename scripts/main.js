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

initProgressBar();
initReveals();
initCounters();

/** Project rows open on click to show the detail. */
function initCardToggles() {
  document.documentElement.classList.add('js');
  document.querySelectorAll('.card').forEach((card) => {
    const more = card.querySelector('.card__more');
    if (!more) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card__toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Show details');
    card.append(btn);
    const toggle = () => {
      const open = card.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', toggle);
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      toggle();
    });
  });
}

initCardToggles();

/** "Show all projects" expands the remaining rows in place. */
function initMoreWork() {
  const btn = document.querySelector('.work__more');
  const extra = document.getElementById('more-work');
  if (!btn || !extra) return;
  btn.addEventListener('click', () => {
    const open = extra.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.firstElementChild.textContent = open ? btn.dataset.less : btn.dataset.more;
  });
}

initMoreWork();

/** Glass navbar: condenses on scroll, tracks the current section, mobile menu. */
function initNav() {
  const nav = document.querySelector('.nav');
  const list = nav?.querySelector('.nav__links');
  if (!list) return;

  const links = [...list.querySelectorAll('a')];

  const syncScroll = () => nav.classList.toggle('is-scrolled', scrollY > 12);
  addEventListener('scroll', syncScroll, { passive: true });
  syncScroll();

  const slider = (cls) => {
    const el = document.createElement('span');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    list.prepend(el);
    return el;
  };
  const hover = slider('nav__hover');
  const pill = slider('nav__pill');

  const place = (el, link) => {
    el.style.width = `${link.offsetWidth}px`;
    el.style.height = `${link.offsetHeight}px`;
    el.style.top = `${link.offsetTop}px`;
    el.style.transform = `translateX(${link.offsetLeft}px)`;
  };

  let current = null;
  const setCurrent = (link) => {
    if (!link || link === current) return;
    links.forEach((l) => {
      l.classList.toggle('is-current', l === link);
      if (l === link) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
    pill.classList.toggle('is-instant', !current);
    place(pill, link);
    pill.classList.add('is-on');
    hover.classList.remove('is-on');
    current = link;
  };

  const clearCurrent = () => {
    if (!current) return;
    links.forEach((l) => {
      l.classList.remove('is-current');
      l.removeAttribute('aria-current');
    });
    pill.classList.remove('is-on');
    current = null;
  };

  const hideHover = () => hover.classList.remove('is-on');
  const showHover = (link) => {
    if (link === current) return hideHover();
    hover.classList.toggle('is-instant', !hover.classList.contains('is-on'));
    place(hover, link);
    hover.classList.add('is-on');
  };
  links.forEach((link) => {
    link.addEventListener('pointerenter', () => showHover(link));
    link.addEventListener('focus', () => showHover(link));
  });
  list.addEventListener('pointerleave', hideHover);
  list.addEventListener('focusout', hideHover);

  const reposition = () => {
    if (!current) return;
    pill.classList.add('is-instant');
    place(pill, current);
  };
  addEventListener('resize', reposition, { passive: true });
  document.fonts?.ready.then(reposition);

  setCurrent(list.querySelector('.is-current'));

  const targetOf = (link) => {
    if (link.dataset.spy) return document.getElementById(link.dataset.spy);
    return link.hash ? document.querySelector(link.hash) : null;
  };
  const targets = links.map(targetOf);

  if (targets.some(Boolean)) {
    let locked = false;
    let queued = false;
    let settle = 0;

    const unlock = () => {
      locked = false;
      queue();
    };

    const spy = () => {
      queued = false;
      if (locked) return;
      const line = scrollY + innerHeight * 0.35;
      let best = -1;
      let bestTop = -1;
      targets.forEach((t, i) => {
        if (t && t.offsetTop <= line && t.offsetTop > bestTop) {
          best = i;
          bestTop = t.offsetTop;
        }
      });
      if (best >= 0) setCurrent(links[best]);
      else clearCurrent();
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(spy);
    };

    addEventListener(
      'scroll',
      () => {
        if (locked) {
          clearTimeout(settle);
          settle = setTimeout(unlock, 140);
        } else queue();
      },
      { passive: true }
    );
    list.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link || !targetOf(link) || link.pathname !== location.pathname) return;
      setCurrent(link);
      locked = true;
      clearTimeout(settle);
      settle = setTimeout(unlock, 1200);
    });
    spy();
  }

  const toggle = nav.querySelector('.nav__toggle');
  if (!toggle) return;

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  list.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });
  matchMedia('(min-width: 721px)').addEventListener('change', () => setOpen(false));
}

initNav();
