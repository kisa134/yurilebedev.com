/* Cogito site behaviour: mobile menu, scroll reveals, tagline word reveal, current section in nav.
   No scroll listeners: everything runs on IntersectionObserver. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile menu
  var toggle = document.querySelector('.menu-toggle');
  var panel = document.getElementById('menu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (panel) panel.setAttribute('aria-hidden', String(!open));
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      setMenu(!document.body.classList.contains('menu-open'));
    });
    if (panel) panel.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    return;
  }

  // Section reveals: once, never replayed
  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealer.observe(el); });

  // Tagline: each word lights up as it crosses a line 40% from the bottom
  var tagline = document.querySelector('.tagline [data-words]');
  if (tagline && !reduced) {
    var lines = tagline.querySelectorAll('.line');
    (lines.length ? lines : [tagline]).forEach(function (line) {
      line.innerHTML = line.textContent.split(/(\s+)/).map(function (t) {
        return /^\s+$/.test(t) || !t ? t : '<span class="w">' + t + '</span>';
      }).join('');
    });
    var words = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('on'); words.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -40% 0px', threshold: 1 });
    tagline.querySelectorAll('.w').forEach(function (w) { words.observe(w); });
  }

  // Home page: mark the section currently in view in the nav
  var links = document.querySelectorAll('.nav-links a[href^="#"]');
  if (links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = byId[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'true');
        } else if (a.hasAttribute('aria-current')) {
          a.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }
})();
