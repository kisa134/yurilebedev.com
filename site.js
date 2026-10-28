/* Cogito notebook behaviour.
   Reveals, ink that draws itself, the ribbon bookmark, the Dubai clock, essay section numbers.
   Scroll work is throttled to one frame; everything else runs on IntersectionObserver. */
(function () {
  document.documentElement.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = 'IntersectionObserver' in window;

  function once(els, fn, opts) {
    if (!els.length) return;
    if (!io || reduced) { els.forEach(fn); return; }
    var ob = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { fn(e.target); ob.unobserve(e.target); } });
    }, opts || { rootMargin: '0px 0px -12% 0px' });
    els.forEach(function (el) { ob.observe(el); });
  }
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  // 1. Sections rise in once
  once($$('.reveal'), function (el) { el.classList.add('in'); });
  once($$('.stamp:not(.reveal .stamp)'), function (el) { el.classList.add('in'); });

  // 2. Ink that draws itself: any svg path with data-draw
  function draw(path, ms, onFrame) {
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = reduced ? 0 : len;
    if (reduced) { if (onFrame) onFrame(1, len); return; }
    var t0 = null;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function step(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / ms), e = ease(k);
      path.style.strokeDashoffset = len * (1 - e);
      if (onFrame) onFrame(e, len);
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  $$('path[data-draw]').forEach(function (p) {
    var len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = reduced ? 0 : len;
  });
  once($$('[data-draw-root]'), function (root) {
    var ms = parseInt(root.getAttribute('data-draw-root'), 10) || 900;
    root.querySelectorAll('path[data-draw]').forEach(function (p) {
      var tracer = root.querySelector('[data-tracer]');
      draw(p, ms, tracer ? function (e, len) {
        var pt = p.getPointAtLength(len * e);
        tracer.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')');
        tracer.style.opacity = 1;
      } : null);
    });
  }, { rootMargin: '0px 0px -20% 0px' });

  // 3. The principle inks in word by word
  var quote = document.querySelector('.quote[data-words]');
  if (quote && io && !reduced) {
    quote.querySelectorAll('.line').forEach(function (line) {
      line.innerHTML = line.textContent.split(/(\s+)/).map(function (t) {
        return /^\s+$/.test(t) || !t ? t : '<span class="w">' + t + '</span>';
      }).join('');
    });
    var wo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); wo.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -38% 0px', threshold: 1 });
    quote.querySelectorAll('.w').forEach(function (w) { wo.observe(w); });
  }

  // 4. Ribbon bookmark = reading progress (article if present, else page)
  var ribbon = document.querySelector('.ribbon');
  if (ribbon) {
    var target = document.querySelector('.prose') || document.body;
    var queued = false;
    function progress() {
      queued = false;
      var r = target.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.4;
      var seen = Math.max(0, Math.min(1, (window.innerHeight * 0.6 - r.top) / Math.max(1, total)));
      ribbon.style.setProperty('--p', (0.06 + seen * 0.94).toFixed(4));
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(progress); } }, { passive: true });
    window.addEventListener('resize', progress);
    progress();
  }

  // 5. Dubai clock in the masthead
  var clock = document.querySelector('[data-clock]');
  if (clock) {
    var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false });
    function tick() {
      var parts = fmt.format(new Date()).split(':');
      clock.innerHTML = parts[0] + '<span class="colon">:</span>' + parts[1];
    }
    tick(); setInterval(tick, 15000);
  }

  // 6. Essays: number the sections in the margin, like a notebook
  var heads = $$('.prose h2');
  heads.forEach(function (h, i) {
    var s = document.createElement('span');
    s.className = 'sec'; s.setAttribute('aria-hidden', 'true');
    s.textContent = '§ ' + String(i + 1).padStart(2, '0') + ' / ' + String(heads.length).padStart(2, '0');
    h.insertBefore(s, h.firstChild);
  });
})();
