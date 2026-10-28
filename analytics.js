/* Cogito site analytics: Google Analytics 4 + first-touch attribution + reading events.
   Change GA_ID only here. Docs: README.md → "Analytics". */
(function () {
  var GA_ID = 'G-JXWPRE2VW4';
  if (!GA_ID) return;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  // First-touch attribution: where the person came from the very first time.
  var params = new URLSearchParams(location.search);
  var KEY = 'cogito_first_touch';
  var first;
  try { first = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { first = null; }
  if (!first) {
    var ref = document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer : '';
    first = {
      source: params.get('utm_source') || (ref ? new URL(ref).hostname : 'direct'),
      medium: params.get('utm_medium') || (ref ? 'referral' : 'none'),
      campaign: params.get('utm_campaign') || '',
      landing: location.pathname,
      date: new Date().toISOString().slice(0, 10)
    };
    try { localStorage.setItem(KEY, JSON.stringify(first)); } catch (e) {}
  }

  gtag('js', new Date());
  gtag('set', 'user_properties', {
    first_source: first.source,
    first_medium: first.medium,
    first_campaign: first.campaign,
    first_landing: first.landing
  });
  gtag('config', GA_ID, { content_group: location.pathname.indexOf('/writing/') === 0 ? 'essay' : 'home' });

  // Clicks: essay links, CTA, outbound (X and others).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = (a.textContent || '').trim().slice(0, 80);
    if (a.host && a.host !== location.host) {
      gtag('event', 'outbound_click', { link_url: a.href, link_text: label, link_domain: a.host });
    } else if (href.indexOf('writing/') !== -1) {
      gtag('event', 'select_essay', { essay_path: href, link_text: label, from_page: location.pathname });
    }
  });

  // Reading depth on essays: 25/50/75/100% and "read" after 60s + 75%.
  var article = document.querySelector('.article');
  if (!article) return;
  var sent = {};
  var start = Date.now();
  function depth() {
    var r = article.getBoundingClientRect();
    var seen = (window.innerHeight - r.top) / r.height;
    return Math.max(0, Math.min(1, seen));
  }
  function check() {
    var d = depth();
    [25, 50, 75, 100].forEach(function (p) {
      if (!sent[p] && d >= p / 100) {
        sent[p] = true;
        gtag('event', 'essay_progress', { percent: p, essay_path: location.pathname });
      }
    });
    if (!sent.read && d >= 0.75 && Date.now() - start > 60000) {
      sent.read = true;
      gtag('event', 'essay_read', { essay_path: location.pathname, seconds: Math.round((Date.now() - start) / 1000) });
    }
  }
  // Throttled to one check per animation frame, never per scroll event.
  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; check(); });
  }, { passive: true });
  setInterval(check, 15000);
})();
