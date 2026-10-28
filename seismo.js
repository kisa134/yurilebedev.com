/* Cogito seismograph.
   One number, the "weather", drives the page: calm = the plain notebook; an impulse wakes the ASCII field,
   scatters the cubs and slips the hero type; Badrik (light, mad) and Sonechka (dark, calm) bring the cubs home.
   Bentlik sits on the zero line and never moves.
   Source: live 1-minute market moves when the public feed answers, otherwise a resting simulation.
   The physics is a damped oscillator: x'' + 2ζω x' + ω² x = kick. */
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isEssay = !!document.querySelector('.prose');
  var body = document.body;
  body.classList.add('has-seismo');

  // ---- DOM: field, zero line, Bentlik, weather instrument ----
  var cv = document.createElement('canvas'); cv.className = 'seismo-field'; cv.setAttribute('aria-hidden', 'true');
  body.insertBefore(cv, body.firstChild);
  var zero = document.createElement('div'); zero.className = 'zero-line'; zero.setAttribute('aria-hidden', 'true');
  body.appendChild(zero);
  var bent = document.createElement('span');
  bent.className = 'bentlik'; bent.tabIndex = 0; bent.setAttribute('role', 'note');
  bent.setAttribute('aria-label', 'Bentlik. The zero line. Everything here returns to him.');
  bent.innerHTML = '▲•ᴥ•▲<span class="tip"><b>Bentlik</b><br>the zero line<br>everything here returns to him</span>';
  body.appendChild(bent);

  var meta = document.querySelector('.masthead .meta');
  var stateEl = null, srcLabel = 'resting signal', trace = null, tc = null;
  if (meta) {
    var w = document.createElement('span');
    w.className = 'weather';
    w.innerHTML = 'Weather <canvas width="144" height="32" aria-hidden="true"></canvas><b class="w-state">calm</b>';
    meta.appendChild(w);
    stateEl = w.querySelector('.w-state'); trace = w.querySelector('canvas'); tc = trace.getContext('2d');
  }
  var heroH1 = document.querySelector('.hero h1');

  var cx = cv.getContext('2d');
  var css = getComputedStyle(document.documentElement);
  function tok(n, f) { var v = css.getPropertyValue(n).trim(); return v || f; }
  var INK = tok('--ink', '#1D1C1A'), INK3 = tok('--ink-3', '#8C867A'), GREEN = tok('--green', '#00A651');
  var FAWN = '#B08A4E', BRINDLE = '#3B3A3E';
  var CW = 11, CH = 18, W, H, cols, rows, dpr, zeroY, bx;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.textBaseline = 'top';
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    zeroY = zero.getBoundingClientRect().top; bx = W / 2;
  }
  window.addEventListener('resize', resize); resize();

  // ---- The weather ----
  var x = 0, v = 0, w0 = 2 * Math.PI * 0.5, zeta = 0.12, energy = 0, hist = [], t = 0, nextSim = 6;
  var damp = isEssay ? 0.4 : 1;           // essays are for reading: the weather reaches them muffled
  var live = false;
  function kick(s) { v += s * (Math.random() < 0.5 ? -1 : 1) * 4; }

  // Live feed: last 1-minute candles of BTC from the public Hyperliquid API. Only the size of the latest
  // move relative to the recent median matters; no price is ever shown.
  var lastCandle = 0;
  function poll() {
    var end = Date.now(), start = end - 45 * 60 * 1000;
    var ctrl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'candleSnapshot', req: { coin: 'BTC', interval: '1m', startTime: start, endTime: end } }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); }).then(function (c) {
      clearTimeout(to);
      if (!Array.isArray(c) || c.length < 10) throw new Error('short');
      live = true; srcLabel = 'live readings';
      var moves = c.map(function (k) { return Math.abs(+k.c - +k.o) / +k.o; });
      var sorted = moves.slice(0, -1).sort(function (a, b) { return a - b; });
      var med = sorted[Math.floor(sorted.length / 2)] || 1e-9;
      var latest = c[c.length - 1], ratio = moves[moves.length - 1] / med;
      if (latest.t !== lastCandle || ratio > 3) {
        lastCandle = latest.t;
        if (ratio > 1.8) kick(Math.min(3, 0.5 + (ratio - 1.8) * 0.6));
      }
    }).catch(function () { clearTimeout(to); live = false; srcLabel = 'resting signal'; });
  }
  if (!reduced) { poll(); setInterval(poll, 30000); }

  // ---- Cubs (the crowd, drawn by the machine) and dogs (the restoring force) ----
  var FACE = { walk: 'ʕ•ᴥ•ʔ', alarm: 'ʕ⊙ᴥ⊙ʔ', sleep: 'ʕ-ᴥ-ʔ', blink: 'ʕ-ᴥ•ʔ' };
  // On phones and in essays the crowd stays out of the text: fewer cubs, and in essays only in the margins.
  var narrow = W < 760;
  var cubs = [], n = isEssay ? (narrow ? 0 : 2) : (narrow ? 2 : 6);
  for (var i = 0; i < n; i++) {
    var hx = isEssay ? W * (i ? 0.86 : 0.06) : W * (0.1 + i * (0.8 / Math.max(1, n - 1))), hy = H * (0.22 + (i % 3) * 0.2);
    cubs.push({ x: hx, y: hy, hx: hx, hy: hy, vx: 0, vy: 0, ph: Math.random() * 10, sl: Math.random() * 6, herd: 0 });
  }
  var dogs = [
    { name: 'badrik', side: 1, fill: FAWN, gain: 9, damp: 0.9, mad: true, face: '▲•ᴥ•▲', run: '▲^ᴥ^▲', x: 0, y: 0, vx: 0, vy: 0, zoom: 0 },
    { name: 'sonechka', side: -1, fill: BRINDLE, gain: 3.2, damp: 0.8, mad: false, face: '▲•ᴥ•▲', run: '▲-ᴥ-▲', x: 0, y: 0, vx: 0, vy: 0, zoom: 0 }
  ];
  function rx(d) { return bx + d.side * 70 - 20; }
  function ry() { return zeroY - 19; }
  dogs.forEach(function (d) { d.x = rx(d); d.y = ry(); });

  function hash(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(px, py) {
    var ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  var RAMP = ' ··.,:;-~=+*#%@';

  function draw(dt) {
    var e = energy, ev = Math.min(e, 0.7), zt = t * (0.05 + e * 0.5);
    cx.clearRect(0, 0, W, H);
    // field: in calm weather nothing is drawn; the CSS dot grid is the notebook
    if (ev > 0.06) {
      cx.font = '500 13px "JetBrains Mono", ui-monospace, monospace';
      for (var r = 0; r < rows; r++) {
        var y = r * CH, sh = 0;
        if (ev > 0.35 && hash(r, Math.floor(t * 12)) > 1 - ev * 0.15) sh = Math.round((hash(r, t) - 0.5) * 6 * ev) * CW;
        for (var c = 0; c < cols; c++) {
          var px = c * CW + sh;
          if (Math.abs(y - zeroY) < 40 && Math.abs(px - bx) < 150) continue; // Bentlik's clearing
          var lv = noise(c * 0.09 + zt, r * 0.14 - zt * 0.6) * (0.1 + ev * 0.55);
          var idx = Math.min(RAMP.length - 1, Math.floor(lv * RAMP.length));
          if (idx < 3) continue;
          var hot = idx > 7 && e > 0.5 && hash(c, r + Math.floor(t * 8)) > 0.96;
          cx.globalAlpha = hot ? 0.7 : 0.1 + idx * 0.025;
          cx.fillStyle = hot ? GREEN : (idx > 8 ? INK : INK3);
          cx.fillText(RAMP[idx], px, y);
        }
      }
    }
    // cubs
    cx.font = '500 14px "JetBrains Mono", ui-monospace, monospace';
    cubs.forEach(function (b, k) {
      var alarm = e > 0.42, calm = e < 0.08;
      if (alarm) {
        var dx = b.x - W / 2, dy = b.y - H / 2, d = Math.hypot(dx, dy) + 1;
        b.vx += (dx / d) * 240 * e * dt + (Math.random() - 0.5) * 110 * dt; b.vy += (dy / d) * 150 * e * dt;
      } else { b.vx += Math.sin(t * 0.3 + k) * 6 * dt + (b.hx - b.x) * 0.02 * dt; b.vy += (b.hy - b.y) * 0.2 * dt; }
      if (b.herd > 0) { b.vx += (b.hx - b.x) * 2.2 * dt; b.vy += (b.hy - b.y) * 2.2 * dt; b.herd -= dt; }
      var dm = alarm ? 0.96 : calm ? 0.9 : 0.985;
      b.vx *= dm; b.vy *= dm; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -60) b.x = W + 20; if (b.x > W + 60) b.x = -20;
      b.y = Math.max(80, Math.min(zeroY - 50, b.y));
      var f = alarm ? FACE.alarm : calm && (t + b.sl) % 14 > 6 ? FACE.sleep : (Math.floor((t + b.ph) * 1.3) % 9 === 0 ? FACE.blink : FACE.walk);
      var hop = alarm ? Math.sin(t * 30 + k) * 3 : Math.abs(Math.sin(t * 2 + b.ph)) * -2;
      cx.globalAlpha = (alarm ? 0.75 : 0.45) * (narrow ? 0.6 : 1); cx.fillStyle = alarm ? GREEN : INK;
      cx.fillText(f, b.x, b.y + hop);
      if (f === FACE.sleep) { cx.globalAlpha = 0.35; cx.fillStyle = INK3; cx.fillText('z', b.x + 54, b.y - 10 - (t * 6 % 8)); }
    });
    // dogs
    if (!(isEssay && narrow)) dogs.forEach(function (d) {
      var work = e > 0.04 && cubs.length > 0, gx = rx(d), gy = ry();
      if (work) {
        var far = null, best = 0;
        cubs.forEach(function (b) { var dd = Math.hypot(b.x - b.hx, b.y - b.hy); if (dd > best && (d.side > 0 ? b.hx >= bx : b.hx < bx)) { best = dd; far = b; } });
        if (far && best > 30) { gx = far.x + (far.x - far.hx) * 0.15; gy = far.y + 14; if (Math.hypot(far.x - d.x, far.y - d.y) < 70) far.herd = 0.6; }
      } else if (d.mad && d.zoom <= 0 && Math.random() < 0.0015) d.zoom = 2.4; // Badrik, being Badrik
      if (d.zoom > 0) { d.zoom -= dt; gx = rx(d) + Math.cos(t * 4) * 130; gy = ry() - 50 + Math.sin(t * 4) * 40; }
      var jit = d.mad && work ? Math.sin(t * 11) * 30 : 0;
      d.vx += (gx + jit - d.x) * d.gain * dt; d.vy += (gy - d.y) * d.gain * dt;
      d.vx *= d.damp; d.vy *= d.damp; d.x += d.vx * dt * 8; d.y += d.vy * dt * 8;
      d.x = Math.max(8, Math.min(W - 70, d.x)); d.y = Math.max(90, Math.min(ry(), d.y));
      var mv = Math.hypot(d.vx, d.vy) > 6, bob = mv ? Math.abs(Math.sin(t * (d.mad ? 18 : 9))) * -3 : 0;
      cx.font = '700 14px "JetBrains Mono", ui-monospace, monospace';
      cx.globalAlpha = 0.9; cx.fillStyle = d.fill; cx.fillText(mv ? d.run : d.face, d.x, d.y + bob);
      cx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      cx.globalAlpha = 0.5; cx.fillStyle = work ? GREEN : INK3; cx.fillText(d.name, d.x + 2, d.y - 12);
    });
    cx.globalAlpha = 1;
    // the hero type slips only on a real impulse
    if (heroH1) {
      if (e > 0.42 && Math.random() < e * 0.4) { heroH1.classList.add('slip'); heroH1.style.setProperty('--gx', ((Math.random() - 0.5) * 7 * e).toFixed(1)); }
      else heroH1.classList.remove('slip');
    }
    // instrument
    if (stateEl) {
      stateEl.textContent = e < 0.08 ? 'calm' : e < 0.3 ? 'ripple' : e < 0.6 ? 'swell' : 'storm';
      stateEl.parentNode.title = 'Weather on this page · ' + srcLabel;
      tc.clearRect(0, 0, 144, 32);
      tc.strokeStyle = INK3; tc.lineWidth = 1; tc.setLineDash([2, 4]); tc.beginPath(); tc.moveTo(0, 16); tc.lineTo(144, 16); tc.stroke(); tc.setLineDash([]);
      tc.strokeStyle = e > 0.42 ? GREEN : INK; tc.lineWidth = 2; tc.beginPath();
      hist.forEach(function (yv, i) { var px = i * 2, py = 16 - Math.max(-14, Math.min(14, yv * 9)); if (i) tc.lineTo(px, py); else tc.moveTo(px, py); });
      tc.stroke();
    }
  }

  var last = performance.now(), acc = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    var a = -2 * zeta * w0 * v - w0 * w0 * x; v += a * dt; x += v * dt;
    if (!live && t > nextSim) { kick(0.6 + Math.random() * 1.4); nextSim = t + 14 + Math.random() * 16; }
    energy = Math.min(1, Math.sqrt(x * x + (v / w0) * (v / w0)) * 0.55 * damp);
    hist.push(x * damp); if (hist.length > 72) hist.shift();
    acc += dt;
    if (acc >= 1 / 30) { draw(acc); acc = 0; }
    requestAnimationFrame(frame);
  }
  function start() { resize(); dogs.forEach(function (d) { d.x = rx(d); d.y = ry(); }); if (reduced) { draw(0); } else { last = performance.now(); requestAnimationFrame(frame); } }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
})();
