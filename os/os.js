/* Bentlik OS. One closure, sections in order: weather, world (shader), windows, notebook, dogs, icons, clock,
   loupe, sky, favicon, sound, context menu, things, island economy, display, terminal, postcard, small things, loop, boot. */
(function () {
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = function () { return innerWidth <= 720; };
  /* display settings: how the world is drawn. Every knob lives here and is remembered per visitor. */
  var MODES = [
    { id: 'bayer8', name: 'Bayer 8', md: 0 }, { id: 'bayer4', name: 'Bayer 4', md: 1 }, { id: 'noise', name: 'Noise', md: 2 },
    { id: 'lines', name: 'Lines', md: 3 }, { id: 'hatch', name: 'Hatch', md: 4 }, { id: 'heat', name: 'Heat', md: 5 },
    { id: 'glyph', name: 'Glyph', md: 9, cpu: 1 }, { id: 'blocks', name: 'Blocks', md: 9, cpu: 1 }, { id: 'braille', name: 'Braille', md: 9, cpu: 1 }, { id: 'dots', name: 'Dots', md: 9, cpu: 1 }
  ], PALS = ['paper', 'phosphor', 'heat'];
  var DEF = { mode: 'bayer8', px: 2, cell: 11, ct: 1, br: 0, grain: .3, pal: 'paper', heat: true, life: true, perf: 'auto' };
  var SET = JSON.parse(JSON.stringify(DEF));
  try { var sv0 = JSON.parse(localStorage.getItem('bentlik-display') || 'null'); if (sv0) Object.keys(DEF).forEach(function (k) { if (sv0[k] !== undefined) SET[k] = sv0[k]; }); } catch (e) {}
  // fast mode: bigger pixels, fewer ray steps, 20 fps, fewer boats. Auto picks it on modest machines or when frames drop.
  var AUTOFAST = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!(navigator.connection && navigator.connection.saveData) || innerWidth <= 720;
  try { if (/[?&]fast\b/.test(location.search)) SET.perf = 'fast'; } catch (e) {}
  function isFast() { return SET.perf === 'fast' || (SET.perf === 'auto' && AUTOFAST); }
  function modeOf(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return MODES[0]; }

  /* ---------- weather: a damped oscillator, x'' + 2ζω x' + ω² x = kick ---------- */
  var W = { x: 0, v: 0, w0: 2 * Math.PI * .45, z: .1, e: 0, hist: [], next: 9, t: 0, last: null };
  function kick(s) { W.v += s * (Math.random() < .5 ? -1 : 1) * 4; W.last = new Date(); }
  document.getElementById('kick').addEventListener('click', function () { kick(2.6); });
  // Live readings: 1-minute BTC candles from the public Hyperliquid API. Only the size of the latest move
  // against the recent median becomes an impulse. No price is ever shown. Falls back to a resting simulation.
  var LIVE = false, lastCandle = 0, srcNote = document.getElementById('wx-src');
  function poll() {
    var end = Date.now(), start = end - 45 * 60 * 1000;
    fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'candleSnapshot', req: { coin: 'BTC', interval: '1m', startTime: start, endTime: end } }) })
      .then(function (r) { return r.json(); }).then(function (c) {
        if (!Array.isArray(c) || c.length < 10) throw new Error('short');
        LIVE = true; if (srcNote) srcNote.textContent = 'Live readings, every 30 seconds. No prices shown.';
        var mv = c.map(function (k) { return Math.abs(+k.c - +k.o) / +k.o; });
        var s = mv.slice(0, -1).sort(function (a, b) { return a - b; }), med = s[Math.floor(s.length / 2)] || 1e-9;
        var lastK = c[c.length - 1], ratio = mv[mv.length - 1] / med;
        if (lastK.t !== lastCandle || ratio > 3) { lastCandle = lastK.t; if (ratio > 1.8) kick(Math.min(3, .5 + (ratio - 1.8) * .6)); }
      }).catch(function () { LIVE = false; if (srcNote) srcNote.textContent = 'Resting signal. The live feed is not answering.'; });
  }
  if (!reduced) { poll(); setInterval(poll, 30000); }
  function weatherWord(e) { return e < .08 ? 'calm' : e < .3 ? 'ripple' : e < .6 ? 'swell' : 'storm'; }

  /* ---------- the world: raymarched island, 8x8 Bayer dither, two tones and one green ---------- */
  var cv = document.getElementById('world');
  var gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  var SCALE = 2, uRo, uTa, uOx, uQ, uTn, uSt, uBp, uBq, uMd, uCt, uBr, uPal, uGn, prog, uR, uT, uE, uM, uLp, uDy, uFg, slowFrames = 0;
  var FS = [
    'precision highp float;',
    'uniform vec2 R; uniform float T; uniform float E; uniform vec2 M; uniform vec4 Lp; uniform float Dy; uniform float Fg; uniform float Md,Ct,Br,Pal,Gn; uniform vec3 Ro,Ta; uniform float Ox,Q,Tn; uniform vec2 St; uniform vec4 Bp[10]; uniform vec4 Bq[10];',
    'const vec2 LP = vec2(.38,-.12); const float TH = .36;',
    'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n2(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'float ter(vec2 p){float d=length(p*vec2(1.,1.2));float m=smoothstep(1.45,.1,d);return m*(.12+.8*fbm(p*1.35+3.))-.12;}',
    'float wat(vec2 p){float a=.01+E*.06;return a*(sin(p.x*7.+T*1.3)+sin(p.y*9.-T*1.1+p.x*2.)+.5*sin((p.x+p.y)*15.+T*2.3));}',
    'float B2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}',
    'float B8(vec2 a){return B2(.25*a)*.0625+B2(.5*a)*.25+B2(a);}',
    'vec3 RMP(float l){l=clamp(l,0.,1.);vec3 a=vec3(.051,.055,.043),b=vec3(.03,.16,.08),c=vec3(0.,.651,.318),d=vec3(.80,.93,.36),e=vec3(.94,.96,.84);return l<.25?mix(a,b,l*4.):l<.5?mix(b,c,l*4.-1.):l<.75?mix(c,d,l*4.-2.):mix(d,e,l*4.-3.);}',
    'float sdB(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}',
    // a boat in its own frame: length 1 along x (bow at +x), y up. Material: 1 hull, 2 wood/mast, 3 sail
    'vec2 boatSD(vec3 p,float k){float tp=clamp((p.x+.1)/.6,0.,1.); float w=.17*(1.-tp*tp*.9);',
    ' vec2 r=vec2(sdB(p-vec3(0.,.02,0.),vec3(.5,.06,w))*.8,1.);',
    ' float cab=sdB(p-vec3(-.22,.14,0.),vec3(.08,.06,.1)); if(cab<r.x)r=vec2(cab,2.);',
    ' float m1=max(length(p.xz-vec2(.06,0.))-.014,abs(p.y-.33)-.27); if(m1<r.x)r=vec2(m1,2.);',
    ' float sl=sdB(p-vec3(-.06,.36,0.),vec3(.11*(1.-clamp((p.y-.14)/.44,0.,1.)*.75),.21,.006))*.8; if(sl<r.x)r=vec2(sl,3.);',
    ' if(k>2.5){r=vec2(sdB(p-vec3(0.,.02,0.),vec3(.5,.06,w))*.8,1.); float wh=sdB(p-vec3(-.02,.12,0.),vec3(.09,.04,.1)); if(wh<r.x)r=vec2(wh,2.); float rl=max(abs(p.y-.1)-.012,max(abs(p.x)-.48,abs(abs(p.z)-w*.92)-.01)); if(rl<r.x)r=vec2(rl,3.); return r;}',
    ' if(k>1.5){float m2=max(length(p.xz-vec2(-.3,0.))-.014,abs(p.y-.28)-.22); if(m2<r.x)r=vec2(m2,2.); float s2=sdB(p-vec3(-.39,.3,0.),vec3(.08,.16,.006)); if(s2<r.x)r=vec2(s2,3.);}',
    ' return r;}',
    'vec3 OBJ;',
    'float objSD(vec3 p){float d=9.; OBJ=vec3(0.);',
    ' for(int i=0;i<10;i++){vec4 b=Bp[i],c=Bq[i]; if(c.x<.5)continue; vec3 q=p-b.xyz; float L=.22*c.y; float bb=length(q)-L*.85; if(bb>d)continue; if(bb>L*.25){d=min(d,bb);continue;}',
    '  float cs=cos(b.w),sn=sin(b.w); vec3 lp=vec3(q.x*cs+q.z*sn,q.y,-q.x*sn+q.z*cs)/L; vec2 r=boatSD(lp,c.x); r.x*=L; if(r.x<d){d=r.x;OBJ=vec3(r.y,c.z,0.);}}',
    ' return d;}',
    'void main(){',
    ' vec2 fc=gl_FragCoord.xy; float row=floor(fc.y/2.);',
    ' if(E>.35 && h2(vec2(row,floor(T*16.)))>1.-E*.14) fc.x+=(h2(vec2(row,T))-.5)*40.*E;',
    ' vec2 uv=(fc-.5*R)/R.y; uv.x-=Ox;',
    ' vec3 ta=Ta; vec3 ro=Ro;',
    ' vec3 f=normalize(ta-ro); vec3 r=normalize(cross(f,vec3(0,1,0))); vec3 u=cross(r,f);',
    ' vec3 rd=normalize(f*1.9+uv.x*r+uv.y*u);',
    ' float t=Tn,hitT=-1.; int kind=0; vec3 HO=vec3(0.);',
    ' for(int i=0;i<200;i++){if(float(i)>Q)break; vec3 p=ro+rd*t; float h=ter(p.xz); float w=wat(p.xz); float dO=objSD(p);',
    '  if(dO<.0005+t*.0012){kind=3;hitT=t;HO=OBJ;break;}',
    '  if(p.y<h){kind=1;hitT=t;break;} if(p.y<w){kind=2;hitT=t;break;}',
    '  t+=min(max(St.x+t*St.y,(p.y-max(h,w))*.35),max(dO*.9,.0004)); if(t>12.)break;}',
    ' vec3 L=normalize(vec3(.35,.75,.55)); float lum=0., g=0.;',
    ' if(kind==1){vec3 p=ro+rd*hitT; vec2 e=vec2(.01,0.);',
    '  vec3 n=normalize(vec3(ter(p.xz-e.xy)-ter(p.xz+e.xy),2.*e.x,ter(p.xz-e.yx)-ter(p.xz+e.yx)));',
    '  float df=max(dot(n,L),0.); lum=.02+.95*pow(df,1.8)+(fbm(p.xz*24.)-.5)*.22; lum*=mix(1.,.75,E)*(.82+.18*Dy);}',
    ' else if(kind==2){vec3 p=ro+rd*hitT; vec2 e=vec2(.02,0.);',
    '  vec3 n=normalize(vec3(wat(p.xz-e.xy)-wat(p.xz+e.xy),2.*e.x,wat(p.xz-e.yx)-wat(p.xz+e.yx)));',
    '  float fr=pow(1.-max(dot(-rd,n),0.),3.); float sp=pow(max(dot(reflect(rd,n),L),0.),36.);',
    '  float am=.01+E*.06; lum=.005+.05*fr+sp*(1.-.6*E)*.7+smoothstep(.6,1.,wat(p.xz)/(am*2.2))*(.12+.12*E); lum+=smoothstep(.03,0.,abs(ter(p.xz)-p.y))*.5; }',
    ' else if(kind==3){vec3 p=ro+rd*hitT; vec2 e=vec2(.0012,0.);',
    '  vec3 n=normalize(vec3(objSD(p+e.xyy)-objSD(p-e.xyy),objSD(p+e.yxy)-objSD(p-e.yxy),objSD(p+e.yyx)-objSD(p-e.yyx)));',
    '  float df=max(dot(n,L),0.)*.75+.25*abs(dot(n,rd)); float base=HO.x<1.5?(HO.y>.5?.55:.16):HO.x<2.5?.5:.95;',
    '  lum=base*(.3+.8*df)*(.75+.25*Dy); if(HO.y>.5&&HO.x>2.5) g+=.6; if(HO.y>.5&&HO.x<1.5) g+=.1;}',
    ' else {float y=max(rd.y,0.); lum=.01+(.05+.2*Dy)*(1.-y*.7);'+'\n'+' if(h2(floor(fc*.5))>.996) lum+=.8*(1.-E)*(1.-Dy);',
    '  float c=fbm(rd.xz/(rd.y+.12)*1.1+vec2(T*.015*(1.+E*8.),0.)); lum+=smoothstep(.55-.3*E,.95,c)*(.12+.18*E);}',
    ' float bh=ter(LP); vec2 o2=ro.xz-LP; vec2 d2=rd.xz; float tt=-dot(o2,d2)/dot(d2,d2);',
    ' float dist=length(o2+d2*tt); float ty=ro.y+rd.y*tt;',
    ' if(tt>0. && (hitT<0.||tt<hitT) && dist<.03 && ty>bh-.02 && ty<bh+TH){float k=(ty-bh)/TH;',
    '  lum=.92-step(.5,fract(k*4.))*.62; if(k>.84){lum=1.;g=1.;}}',
    ' vec3 lamp=vec3(LP.x,bh+TH*.92,LP.y);',
    ' for(int s=0;s<2;s++){float ang=T*.8+float(s)*3.14159; vec3 D=normalize(vec3(cos(ang),-.05,sin(ang)));',
    '  vec3 w0=ro-lamp; float b=dot(rd,D),dd=dot(rd,w0),ee=dot(D,w0); float den=max(1.-b*b,1e-4);',
    '  float sc=(b*ee-dd)/den, tc=(ee-b*dd)/den;',
    '  if(sc>0.&&tc>0.&&(hitT<0.||sc<hitT)){float q=length(w0+rd*sc-D*tc); float wd=.006+tc*.02;',
    '   g+=exp(-q*q/(wd*wd))*exp(-tc*.3)*.6;}}',
    ' { vec3 w0=ro-lamp; float sc=max(dot(lamp-ro,rd),0.); float q=length(w0+rd*sc); if(hitT<0.||sc<hitT) g+=exp(-q*q*4000.)*1.4; }',
    ' if(E>.25){float col=floor(fc.x/2.); float r=h2(vec2(col,floor(fc.y/7.+T*26.+h2(vec2(col,1.))*40.))); if(r>1.-(E-.25)*.05) lum+=.55;}'+'\n'+' if(E>.6 && h2(vec2(floor(T*7.),3.))>.95) lum+=.18;',
    ' if(kind==2) lum+=.06*Dy; if(Fg>0.){float fd=hitT<0.?1.:1.-exp(-hitT*.45); lum=mix(lum,.32,Fg*fd*.8);}',
    ' lum=clamp((lum-.5)*Ct+.5+Br,0.,1.); vec2 q=gl_FragCoord.xy; float th=B8(q)+.004;',
    ' if(Md>.5&&Md<1.5) th=B2(.5*q)*.25+B2(q)+.03; else if(Md>1.5&&Md<2.5) th=h2(floor(q)*.731+3.1); else if(Md>2.5&&Md<3.5) th=abs(fract(q.y/5.)-.5)*2.;',
    ' else if(Md>3.5&&Md<4.5){float a1=abs(fract((q.x+q.y)/7.)-.5)*2.,a2=abs(fract((q.x-q.y)/7.)-.5)*2.; th=(a1<.9-lum*1.05||(lum<.45&&a2<.8-lum*1.8))?2.:-1.;}',
    ' vec3 INK=vec3(.051,.055,.043), PAP=vec3(.812,.796,.745), GR=vec3(0.,.651,.318);',
    ' vec3 LIME=vec3(.80,.93,.36), CREAM=vec3(.94,.96,.84), DEEP=vec3(.03,.16,.08);',
    ' float gr=(h2(gl_FragCoord.xy+fract(T*7.)*91.)-.5);',
    ' bool inL=Md<8.5&&gl_FragCoord.x>Lp.x&&gl_FragCoord.x<Lp.z&&gl_FragCoord.y>Lp.y&&gl_FragCoord.y<Lp.w;',
    ' vec3 col;',
    ' if(inL){float l=clamp(lum*1.05+g*.6+gr*.07,0.,1.);',
    '  col=l<.35?mix(INK,DEEP,l/.35):l<.7?mix(DEEP,LIME,(l-.35)/.35):mix(LIME,CREAM,(l-.7)/.3);}',
    ' else if(Md>8.5){col=vec3(lum); col.g+=clamp(g,0.,1.)*.6;}',
    ' else {vec3 HI=Pal<.5?PAP:Pal<1.5?LIME:RMP(lum*.85+.15); col=lum>th?HI:INK;',
    '  if(Md>4.5&&Md<5.5) col=RMP(floor(clamp(lum+(B8(q)-.5)*.2,0.,1.)*6.)/6.);',
    '  float gg=clamp(g,0.,1.4);',
    '  vec3 gc=mix(GR,mix(LIME,CREAM,clamp(g-1.,0.,1.)),clamp(g*.8,0.,1.));',
    '  col=mix(col,gc,clamp(gg*.8,0.,.92)); col+=gr*.05*smoothstep(.02,.3,gg); col+=gr*Gn*.14;}',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; } return s; }
  if (gl) {
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (vs && fs) {
      prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uDy = gl.getUniformLocation(prog, 'Dy'); uFg = gl.getUniformLocation(prog, 'Fg'); uLp = gl.getUniformLocation(prog, 'Lp'); uR = gl.getUniformLocation(prog, 'R'); uT = gl.getUniformLocation(prog, 'T'); uE = gl.getUniformLocation(prog, 'E'); uM = gl.getUniformLocation(prog, 'M');
      uMd = gl.getUniformLocation(prog, 'Md'); uCt = gl.getUniformLocation(prog, 'Ct'); uBr = gl.getUniformLocation(prog, 'Br'); uPal = gl.getUniformLocation(prog, 'Pal'); uGn = gl.getUniformLocation(prog, 'Gn'); uRo = gl.getUniformLocation(prog, 'Ro'); uTa = gl.getUniformLocation(prog, 'Ta'); uOx = gl.getUniformLocation(prog, 'Ox'); uQ = gl.getUniformLocation(prog, 'Q'); uTn = gl.getUniformLocation(prog, 'Tn'); uSt = gl.getUniformLocation(prog, 'St'); uBp = gl.getUniformLocation(prog, 'Bp'); uBq = gl.getUniformLocation(prog, 'Bq');
    }
  }
  function resize() {
    SCALE = Math.max(1, Math.min(8, SET.px + (isFast() ? 1 : 0) + (innerWidth > 2200 ? 1 : 0)));
    cv.width = Math.ceil(innerWidth / SCALE); cv.height = Math.ceil(innerHeight / SCALE);
    if (gl) gl.viewport(0, 0, cv.width, cv.height);
  }
  addEventListener('resize', resize); resize();

  // the same noise in JS, to find the lighthouse on screen
  function fr(x) { return x - Math.floor(x); }
  function h2(x, y) { return fr(Math.sin(x * 127.1 + y * 311.7) * 43758.5453); }
  function n2(x, y) { var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; }
  function fbm(x, y) { var a = .5, s = 0; for (var i = 0; i < 5; i++) { s += a * n2(x, y); var nx = x * 2.03 + 1.7, ny = y * 2.03 + 9.2; x = nx; y = ny; a *= .5; } return s; }
  function ter(x, y) { var d = Math.hypot(x, y * 1.2); var t = Math.min(1, Math.max(0, (d - 1.45) / (.1 - 1.45))); var m = t * t * (3 - 2 * t); return m * (.12 + .8 * fbm(x * 1.35 + 3, y * 1.35 + 3)) - .12; }
  var LPX = .38, LPZ = -.12, LBH = ter(LPX, LPZ);
  var hit = document.getElementById('lh-hit');
  hit.addEventListener('click', function (e) { if (e.shiftKey) { kick(2.6); return; } openWin('bentlik'); });

  var mouse = [0, 0], ms = [0, 0];
  addEventListener('pointermove', function (e) { mouse = [(e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * -2]; });

  /* ---------- windows ---------- */
  var wins = {}, zTop = 20;
  document.querySelectorAll('.win').forEach(function (w) {
    var id = w.id.slice(2); wins[id] = w;
    if (w.dataset.w) w.style.width = w.dataset.w + 'px';
    w.addEventListener('pointerdown', function () { focusWin(w); });
    w.querySelector('.x').addEventListener('click', function (e) { e.stopPropagation(); closeWin(w); });
    var bar = w.querySelector('.bar'), sx, sy, ox, oy, drag = false;
    bar.addEventListener('pointerdown', function (e) {
      if (small() || e.target.closest('button')) return;
      drag = true; w.classList.add('drag'); sx = e.clientX; sy = e.clientY; ox = w.offsetLeft; oy = w.offsetTop; bar.setPointerCapture(e.pointerId);
    });
    var lastTrail = 0;
    bar.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!reduced && performance.now() - lastTrail > 45) { lastTrail = performance.now(); trail(w); }
      var nx = Math.max(-w.offsetWidth + 120, Math.min(innerWidth - 120, ox + e.clientX - sx));
      var ny = Math.max(topMin(), Math.min(innerHeight - 40, oy + e.clientY - sy));
      w.style.left = nx + 'px'; w.style.top = ny + 'px';
    });
    bar.addEventListener('pointerup', function () { if (drag) saveWins(); drag = false; w.classList.remove('drag'); });
  });
  // v2: v1 saved hidden windows at 0,0 (a hidden element reports offset 0), which sent them under the menu bar
  var saved = {}; try { localStorage.removeItem('bentlik-wins'); saved = JSON.parse(localStorage.getItem('bentlik-wins-2') || '{}') || {}; } catch (e) {}
  function topMin() { var mbH = document.getElementById('menubar'); return (mbH ? mbH.offsetHeight : 32) + 6; }
  function clampWin(w) { var x = w.offsetLeft, y = w.offsetTop, nx = Math.max(-w.offsetWidth + 120, Math.min(innerWidth - 120, x)), ny = Math.max(topMin(), Math.min(innerHeight - 40, y)); if (nx !== x) w.style.left = nx + 'px'; if (ny !== y) w.style.top = ny + 'px'; }
  Object.keys(saved).forEach(function (k) { if (wins[k] && typeof saved[k].open === 'boolean') wins[k].hidden = !saved[k].open; });
  function saveWins() {
    if (small()) return;
    var o = {}; Object.keys(wins).forEach(function (k) { var w = wins[k], prev = saved[k] || {}; o[k] = { open: !w.hidden };
      if (!w.hidden && w.dataset.placed && !w.classList.contains('closing')) { o[k].x = w.offsetLeft; o[k].y = w.offsetTop; } else if (typeof prev.x === 'number') { o[k].x = prev.x; o[k].y = prev.y; } });
    saved = o; try { localStorage.setItem('bentlik-wins-2', JSON.stringify(o)); } catch (e) {}
  }
  function trail(w) {
    var t = document.createElement('div'); t.className = 'trail';
    t.style.left = w.offsetLeft + 'px'; t.style.top = w.offsetTop + 'px'; t.style.width = w.offsetWidth + 'px'; t.style.height = w.offsetHeight + 'px'; t.style.zIndex = +w.style.zIndex - 1;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 700);
  }
  function layout() {
    if (small()) return;
    Object.keys(wins).forEach(function (k) {
      var w = wins[k]; if (w.dataset.placed) return;
      var sv = saved[k];
      if (sv && typeof sv.x === 'number' && sv.x > -200 && sv.x < innerWidth - 120 && sv.y >= topMin() && sv.y < innerHeight - 40) { w.style.left = sv.x + 'px'; w.style.top = sv.y + 'px'; if (w.dataset.h) w.style.maxHeight = Math.round(innerHeight * parseFloat(w.dataset.h)) + 'px'; w.dataset.placed = '1'; return; }
      var ww = Math.min(parseFloat(w.dataset.w || 360), innerWidth - 32);
      var x = Math.round(Math.min(innerWidth - ww - 16, Math.max(110, innerWidth * parseFloat(w.dataset.x))));
      var y = Math.round(Math.max(44, innerHeight * parseFloat(w.dataset.y)));
      w.style.left = x + 'px'; w.style.top = y + 'px';
      if (w.dataset.h) w.style.maxHeight = Math.round(innerHeight * parseFloat(w.dataset.h)) + 'px';
      if (y + 220 > innerHeight) w.style.top = Math.max(44, innerHeight - 260) + 'px';
      w.dataset.placed = '1';
    });
    Object.keys(wins).forEach(function (k) { if (!wins[k].hidden) clampWin(wins[k]); });
  }
  function tidy() {
    saved = {}; try { localStorage.removeItem('bentlik-wins-2'); } catch (e) {}
    Object.keys(wins).forEach(function (k) { delete wins[k].dataset.placed; }); layout(); saveWins();
  }
  function closeWin(w) {
    sfx('close');
    if (reduced) { w.hidden = true; pickTop(); saveWins(); return; }
    w.classList.add('closing');
    setTimeout(function () { w.classList.remove('closing'); w.hidden = true; pickTop(); saveWins(); }, 260);
  }
  function focusWin(w) { w.style.zIndex = ++zTop; document.querySelectorAll('.win.top').forEach(function (o) { o.classList.remove('top'); }); w.classList.add('top'); }
  function pickTop() { var best = null; Object.keys(wins).forEach(function (k) { var w = wins[k]; if (!w.hidden && (!best || +w.style.zIndex > +best.style.zIndex)) best = w; }); if (best) focusWin(best); }
  function openWin(id) {
    var w = wins[id]; if (!w) return;
    var was = w.hidden; w.hidden = false; layout(); clampWin(w); focusWin(w);
    w._h = (w._h || 0) + .5; if (was) { w.classList.remove('opening'); void w.offsetWidth; w.classList.add('opening'); sfx('open'); saveWins(); }
    if (small()) w.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (id === 'terminal') setTimeout(function () { var ti = document.getElementById('term-in'); if (ti) ti.focus({ preventScroll: true }); }, 80);
  }
  document.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openWin(b.dataset.open); }); });
  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
    var k = e.key.toLowerCase(), map = { n: 'notebook', w: 'weather', d: 'dogs', g: 'games', a: 'about', b: 'bentlik', t: 'things', s: 'systems', v: 'display', p: 'harbour', '`': 'terminal' };
    if (k === 'm' && document.getElementById('boot').classList.contains('done')) cycleMode();
    if (map[k] && document.getElementById('boot').classList.contains('done')) openWin(map[k]);
    if (e.key === 'Escape' && document.getElementById('ctx').hidden) { var t = document.querySelector('.win.top'); if (t && !t.hidden) closeWin(t); }
  });
  addEventListener('resize', function () { Object.keys(wins).forEach(function (k) { delete wins[k].dataset.placed; }); layout(); });
  var brand = document.querySelector('.menubar .brand'); if (brand) { brand.title = 'Double-click to tidy the windows'; brand.addEventListener('dblclick', function () { tidy(); toast('windows tidied'); }); }
  layout(); focusWin(wins.about);

  /* ---------- notebook ---------- */
  var nb = document.getElementById('nb-body');
  function words(h) { return h.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length; }
  function listView() {
    nb.innerHTML = '<p class="mono dim" style="margin:0 0 10px">~/notebook · ' + ESSAYS.length + ' entries</p><div class="entries">' +
      ESSAYS.map(function (e, i) {
        return '<button class="entry" type="button" data-i="' + i + '"><span class="n mono">' + String(i + 1).padStart(3, '0') + '</span><span><b>' + e.title + '</b><span class="d mono">Oct 2026 · ' + Math.max(1, Math.round(words(e.prose) / 200)) + ' min</span></span></button>';
      }).join('') + '</div>';
    nb.querySelectorAll('.entry').forEach(function (b) { b.addEventListener('click', function () { readView(+b.dataset.i); }); });
  }
  function readView(i) {
    var e = ESSAYS[i];
    nb.innerHTML = '<div class="reader"><button class="back mono" type="button">← ~/notebook</button><p class="mono g" style="margin:0">' + String(i + 1).padStart(3, '0') + '</p><h2>' + e.title + '</h2><p class="deck">' + e.deck + '</p><div class="prose">' + e.prose + '</div><p class="fine"><a class="ghost mono" href="writing/' + e.slug + '.html">Open as a page ↗</a></p><p class="mono dim">Not investment advice.</p></div>';
    nb.scrollTop = 0;
    nb.querySelector('.back').addEventListener('click', listView);
  }
  listView();

  /* ---------- dogs: one filter for everything ---------- */
  var album = document.getElementById('album'), caps = ['fawn · 01', 'fawn · 02', 'sonechka'];
  function bayer4(x, y) { var m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; return (m[(y % 4) * 4 + (x % 4)] + .5) / 16; }
  DOG_IMGS.forEach(function (src, i) {
    var fig = document.createElement('figure');
    fig.innerHTML = '<div class="photo" tabindex="0"><canvas></canvas><img alt="French bulldog, photo ' + (i + 1) + '"></div><figcaption class="mono dim">' + caps[i] + '</figcaption>';
    album.appendChild(fig);
    var img = fig.querySelector('img'), c = fig.querySelector('canvas');
    img.onload = function () {
      var w = 120, h = Math.round(w * img.naturalHeight / img.naturalWidth); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h), p = d.data;
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        var o = (yy * w + xx) * 4, l = (p[o] * .3 + p[o + 1] * .59 + p[o + 2] * .11) / 255;
        l = Math.min(1, Math.max(0, (l - .12) * 1.35));
        var on = l > bayer4(xx, yy); p[o] = on ? 207 : 13; p[o + 1] = on ? 203 : 14; p[o + 2] = on ? 190 : 11;
      }
      x.putImageData(d, 0, 0);
    };
    img.src = src;
  });

  /* ---------- pixel icons ---------- */
  var PX = {
    notebook: ['..######', '.#....##', '.#.##.##', '.#....##', '.#.##.##', '.#....##', '.#....##', '..######'],
    weather: ['........', '..##....', '.#..##..', '#.....#.', '.######.', '..#.#.#.', '.#.#.#..', '........'],
    dog: ['#.....#.', '##...##.', '.#####..', '.#.#.#..', '.#####..', '..#.#...', '.#####..', '........'],
    cart: ['.######.', '.#.##.#.', '.######.', '.#....#.', '.#.##.#.', '.#....#.', '.######.', '.#.#.#..'],
    anchor: ['...##...', '...##...', '.######.', '...##...', '...##...', '#..##..#', '##.##.##', '.######.'],
    term: ['########', '#......#', '#.#....#', '#..#...#', '#.#.##.#', '#......#', '########', '........'],
    box: ['........', '.######.', '#......#', '########', '#.#..#.#', '#......#', '#......#', '########'],
    info: ['.######.', '.#....#.', '.#.##.#.', '.#....#.', '.#.##.#.', '.#.##.#.', '.#....#.', '.######.']
  };
  document.querySelectorAll('svg[data-px]').forEach(function (s) {
    var m = PX[s.dataset.px]; s.setAttribute('viewBox', '0 0 8 8');
    s.innerHTML = m.map(function (row, y) { return row.split('').map(function (ch, x) { return ch === '#' ? '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + (s.dataset.px === 'weather' && y > 4 ? '#00A651' : '#E4E1D7') + '"/>' : ''; }).join(''); }).join('');
  });

  /* ---------- clock ---------- */
  var clock = document.getElementById('clock');
  var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false });
  function tick() { var tp = fmt.format(new Date()).split(':'); clock.innerHTML = tp[0] + '<span class="c">:</span>' + tp[1]; } tick(); setInterval(tick, 15000);

  /* ---------- main loop ---------- */
  /* ---------- loupe: an analog window into the dithered world ---------- */
  var LW = 260, LH = 170, lp = [innerWidth * .7, innerHeight * .45], lpT = lp.slice(), lpOn = false, lpA = 0;
  var lpEl = document.getElementById('loupe'), lpLab = document.getElementById('loupe-lab'), guides = document.querySelectorAll('.guide');
  var fine = matchMedia('(pointer: fine)').matches;
  addEventListener('pointermove', function (e) {
    lpT = [e.clientX, e.clientY];
    var t = e.target;
    lpOn = fine && !reduced && (t === document.body || t.id === 'world' || t.classList.contains('desk') || t.id === 'lh-hit');
  });
  addEventListener('pointerleave', function () { lpOn = false; });
  document.addEventListener('mouseleave', function () { lpOn = false; });
  function placeLoupe() {
    var on = lpA > .5, x = Math.round(lp[0] - LW / 2), y = Math.round(lp[1] - LH / 2);
    lpEl.style.opacity = on ? 1 : 0;
    lpEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    guides[0].style.transform = 'translateY(' + y + 'px)'; guides[1].style.transform = 'translateY(' + (y + LH) + 'px)';
    guides[2].style.transform = 'translateX(' + x + 'px)'; guides[3].style.transform = 'translateX(' + (x + LW) + 'px)';
    guides.forEach(function (g) { g.style.opacity = on ? 1 : 0; });
    if (on) lpLab.textContent = 'ANALOG  x' + String(Math.round(lp[0])).padStart(4, '0') + ' y' + String(Math.round(lp[1])).padStart(4, '0') + '  ' + LW + '×' + LH;
  }

  /* ---------- time of day in Dubai: dawn fog, day sky, night stars (try ?hour=6.5) ---------- */
  var SKY = { day: 0, fog: 0 }, hourOverride = null;
  try { var hq = new URLSearchParams(location.search).get('hour'); if (hq !== null && hq !== '') hourOverride = parseFloat(hq); } catch (e) {}
  var hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: 'numeric', minute: 'numeric', hour12: false });
  function sstep(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function updateSky() {
    var h = hourOverride;
    if (h === null || isNaN(h)) { var pp = hourFmt.format(new Date()).split(':'); h = (+pp[0]) + (+pp[1]) / 60; }
    SKY.day = sstep(5.5, 8, h) * (1 - sstep(17.5, 19.5, h));
    SKY.fog = Math.max(0, 1 - Math.abs(h - 6.8) / 1.4);
    SKY.word = h < 5 || h >= 20 ? 'night' : h < 8 ? 'dawn' : h < 17.5 ? 'day' : 'dusk';
  }
  updateSky(); setInterval(updateSky, 60000);

  /* ---------- favicon: a tiny lighthouse that blinks with the beam ---------- */
  var fav = document.querySelector('link[rel="icon"]'), fc = document.createElement('canvas'); fc.width = fc.height = 32;
  var fx = fc.getContext('2d'), favLit = null;
  function drawFav(lit) {
    if (lit === favLit) return; favLit = lit;
    fx.fillStyle = '#0D0E0B'; fx.fillRect(0, 0, 32, 32);
    fx.fillStyle = '#CFCBBE'; fx.fillRect(13, 12, 6, 16); fx.fillStyle = '#0D0E0B'; fx.fillRect(13, 17, 6, 2); fx.fillRect(13, 23, 6, 2);
    fx.fillStyle = '#CFCBBE'; fx.fillRect(4, 28, 24, 2);
    fx.fillStyle = lit ? '#00A651' : '#34352F'; fx.fillRect(12, 6, 8, 6);
    if (lit) { fx.fillStyle = 'rgba(0,166,81,.55)'; fx.fillRect(20, 7, 12, 3); fx.fillRect(0, 7, 12, 3); }
    try { fav.href = fc.toDataURL('image/png'); } catch (e) {}
  }

  /* ---------- sound: the sea, wind in a storm, a click for windows. Off until asked. ---------- */
  var AC = null, seaGain, seaFilt, soundOn = false, sBtn = document.getElementById('sound');
  function startSound() {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
    AC = new Ctx();
    var len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var wn = Math.random() * 2 - 1; last = (last + .02 * wn) / 1.02; d[i] = last * 3.5; }
    var src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    seaFilt = AC.createBiquadFilter(); seaFilt.type = 'lowpass'; seaFilt.frequency.value = 420;
    seaGain = AC.createGain(); seaGain.gain.value = 0;
    src.connect(seaFilt); seaFilt.connect(seaGain); seaGain.connect(AC.destination); src.start();
    return true;
  }
  function soundTick(T, e) {
    if (!AC || !soundOn) return;
    var swell = .5 + .5 * Math.sin(T * .45) * Math.sin(T * .17 + 1);
    seaGain.gain.setTargetAtTime(.05 + .07 * swell + .16 * e, AC.currentTime, .3);
    seaFilt.frequency.setTargetAtTime(320 + 260 * swell + 2400 * e, AC.currentTime, .3);
  }
  function sfx(kind) {
    if (!AC || !soundOn) return;
    var o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = 'square'; o.frequency.setValueAtTime(kind === 'open' ? 1320 : 660, t); o.frequency.exponentialRampToValueAtTime(kind === 'open' ? 1760 : 440, t + .04);
    g.gain.setValueAtTime(.025, t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .07);
  }
  sBtn.addEventListener('click', function () {
    if (!AC && !startSound()) return;
    soundOn = !soundOn;
    if (soundOn && AC.state === 'suspended') AC.resume();
    if (!soundOn) seaGain.gain.setTargetAtTime(0, AC.currentTime, .2);
    sBtn.textContent = soundOn ? 'sound on' : 'sound off'; sBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) sfx('open');
  });

  /* ---------- right click on the wallpaper ---------- */
  var cm = document.getElementById('ctx');
  function closeCtx() { cm.hidden = true; }
  addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (small() || !(t === document.body || t.id === 'world' || t.classList.contains('desk') || t.id === 'lh-hit')) return;
    e.preventDefault();
    cm.hidden = false;
    cm.style.left = Math.min(e.clientX, innerWidth - cm.offsetWidth - 8) + 'px';
    cm.style.top = Math.min(e.clientY, innerHeight - cm.offsetHeight - 8) + 'px';
    cm.querySelector('[data-act="toggle"]').textContent = document.body.classList.contains('bare') ? 'Show windows' : 'Hide windows';
    sfx('open');
  });
  cm.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'kick') kick(2.6);
    if (a === 'helm') helm(true);
    if (a === 'tidy') { tidy(); toast('windows tidied'); }
    if (a === 'postcard') postcard();
    if (a === 'toggle') document.body.classList.toggle('bare');
    if (a === 'notebook' || a === 'bentlik') openWin(a);
    if (a === 'copy') { try { navigator.clipboard.writeText(location.origin + '/'); b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1200); return; } catch (err) {} }
    closeCtx();
  });
  addEventListener('pointerdown', function (e) { if (!cm.hidden && !e.target.closest('#ctx')) closeCtx(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCtx(); });

  /* ---------- folders on the desktop fan out a preview on hover ---------- */
  function fanFor(icon, cards) {
    var f = document.createElement('div'); f.className = 'fan'; f.setAttribute('aria-hidden', 'true');
    cards.forEach(function (c, i) { var d = document.createElement('div'); d.className = 'card c' + i; d.innerHTML = c; f.appendChild(d); });
    icon.appendChild(f);
  }
  var icNb = document.querySelector('.icon[data-open="notebook"]'), icDogs = document.querySelector('.icon[data-open="dogs"]'), icGames = document.querySelector('.icon[data-open="games"]');
  if (icNb) fanFor(icNb, ESSAYS.map(function (e, i) { return '<span class="mono g">' + String(i + 1).padStart(3, '0') + '</span><b>' + e.title + '</b>'; }));
  if (icDogs) fanFor(icDogs, DOG_IMGS.map(function (src) { return '<img src="' + src + '" alt="">'; }));
  if (icGames) fanFor(icGames, ['<b>Ant Kitchen</b><span class="mono">PROTOTYPE</span>', '<b>BomberMeme</b><span class="mono">NEW EDITION</span>']);

  /* ---------- small things ---------- */
  // the tab title follows the weather; when you leave, the light stays on
  var baseTitle = document.title, lastWord = '';
  document.addEventListener('visibilitychange', function () { document.title = document.hidden ? 'the light is still on' : baseTitle; });
  function titleWeather(word) {
    if (document.hidden || word === lastWord) return; lastWord = word;
    document.title = word === 'calm' ? baseTitle : 'Bentlik OS · ' + word;
  }
  // idle: after a minute without input the windows step back and the island is left alone
  var idleT = null;
  function wake() { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(function () { document.body.classList.add('idle'); }, 60000); }
  ['pointermove', 'keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { addEventListener(ev, wake, { passive: true }); });
  wake();
  // for whoever opens the console
  try { console.log('%c\n      ▲\n     ▐█▌   bentlik os\n     ▐▒▌   the light is on.\n  ~~~▐█▌~~~~~~~~~~~~~~~~\n\n  you read source code. respect.\n  say hi: x.com/Cogit08\n', 'font-family:monospace;color:#00A651'); } catch (e) {}


  /* ---------- Things: the objects on the desk ---------- */
  (function () {
    var shelf = document.getElementById('shelf');
    document.querySelectorAll('[data-shelf]').forEach(function (b) { b.addEventListener('click', function () { shelf.scrollBy({ left: +b.dataset.shelf * 208, behavior: reduced ? 'auto' : 'smooth' }); }); });
    shelf.addEventListener('wheel', function (e) { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { shelf.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    // polaroids get the same dither as everything else
    document.querySelectorAll('.pola .p').forEach(function (p, i) {
      var img = p.querySelector('img'), c = p.querySelector('canvas');
      img.onload = function () {
        var w = 66, h = 66, x = c.getContext('2d'); c.width = w; c.height = h;
        var s = Math.min(img.naturalWidth, img.naturalHeight); x.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, w, h);
        var d = x.getImageData(0, 0, w, h), q = d.data;
        for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) { var o = (yy * w + xx) * 4, l = (q[o] * .3 + q[o + 1] * .59 + q[o + 2] * .11) / 255; l = Math.min(1, Math.max(0, (l - .12) * 1.35)); var on = l > bayer4(xx, yy); q[o] = on ? 207 : 13; q[o + 1] = on ? 203 : 14; q[o + 2] = on ? 190 : 11; }
        x.putImageData(d, 0, 0);
      };
      img.src = DOG_IMGS[i % DOG_IMGS.length];
    });
    // the cassette is the sound switch
    var tapeB = document.getElementById('tape-b'), tape = document.getElementById('tape'), tapeH = document.getElementById('tape-h');
    tapeB.addEventListener('click', function () { sBtn.click(); });
    new MutationObserver(function () { var on = sBtn.getAttribute('aria-pressed') === 'true'; tape.classList.toggle('on', on); tapeB.setAttribute('aria-pressed', String(on)); tapeH.textContent = on ? 'playing · click to stop' : 'click to play'; }).observe(sBtn, { attributes: true });
    // the seismograph: a button you can actually press
    document.getElementById('seis-b').addEventListener('click', function () { kick(2.6); });
    // the card tilts toward the cursor
    var pass = document.getElementById('pass');
    pass.addEventListener('pointermove', function (e) {
      var r = pass.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      pass.classList.add('live'); pass.style.setProperty('--ry', ((x - .5) * 18).toFixed(1) + 'deg'); pass.style.setProperty('--rx', ((.5 - y) * 14).toFixed(1) + 'deg');
      pass.style.setProperty('--mx', (x * 100).toFixed(0) + '%'); pass.style.setProperty('--my', (y * 100).toFixed(0) + '%');
    });
    pass.addEventListener('pointerleave', function () { pass.classList.remove('live'); pass.style.setProperty('--rx', '0deg'); pass.style.setProperty('--ry', '0deg'); });
  })();
  // Bentlik's dial: turn it anywhere, it always rings back to zero (the same damped spring as the weather)
  var dial = document.getElementById('dial'), dialR = document.getElementById('dial-r'), knurl = dial.querySelector('.knurl');
  var DL = { a: 0, v: 0, drag: false, a0: 0, p0: 0 };
  function dAng(e) { var r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2) * 180 / Math.PI; }
  dial.addEventListener('pointerdown', function (e) { DL.drag = true; DL.a0 = DL.a; DL.p0 = dAng(e); dial.classList.add('drag'); dial.setPointerCapture(e.pointerId); });
  dial.addEventListener('pointermove', function (e) { if (!DL.drag) return; var d = dAng(e) - DL.p0; d = ((d + 540) % 360) - 180; DL.a = Math.max(-170, Math.min(170, DL.a0 + d)); DL.v = 0; });
  dial.addEventListener('pointerup', function () { DL.drag = false; dial.classList.remove('drag'); if (Math.abs(DL.a) > 40) kick(Math.abs(DL.a) / 90); });
  dial.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { DL.a = Math.min(170, DL.a + 30); e.preventDefault(); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { DL.a = Math.max(-170, DL.a - 30); e.preventDefault(); } });
  // barometer, harbour tape, ship in a bottle, shell jar
  (function () { var g = document.getElementById('baro-ticks'), out = ''; for (var i = 0; i <= 40; i++) { var a = (-120 + i * 6) * Math.PI / 180, r1 = i % 5 ? 44 : 41; out += '<line x1="' + (60 + Math.sin(a) * r1).toFixed(1) + '" y1="' + (60 - Math.cos(a) * r1).toFixed(1) + '" x2="' + (60 + Math.sin(a) * 47).toFixed(1) + '" y2="' + (60 - Math.cos(a) * 47).toFixed(1) + '"/>'; } g.innerHTML = out; })();
  var baroN = document.getElementById('baro-n'), baroR = document.getElementById('baro-ref'), baroHist = [], tapeRoll = document.getElementById('tape-roll'), pled = document.getElementById('pled'), tapeSeen = {};
  var btShip = document.getElementById('bt-ship'), btW1 = document.getElementById('bt-wave'), btW2 = document.getElementById('bt-wave2'), jarFill = document.getElementById('jar-fill'), jarN = document.getElementById('jar-n'), baroT = 0;
  function tapePrint(txt) { var d = document.createElement('div'); d.innerHTML = '<b>' + fmtS.format(new Date()).slice(0, 5) + '</b> ' + txt; tapeRoll.appendChild(d); while (tapeRoll.children.length > 9) tapeRoll.firstChild.remove(); pled.classList.add('on'); setTimeout(function () { pled.classList.remove('on'); }, 500); }
  function waveD(y0, amp, ph, k) { var d = 'M0 100 L0 ' + y0; for (var x = 0; x <= 160; x += 8) d += ' L' + x + ' ' + (y0 + Math.sin(x * k + ph) * amp + Math.sin(x * k * 2.3 - ph * 1.3) * amp * .4).toFixed(1); return d + ' L160 100 Z'; }
  function deskTick() {
    if (wins.things.hidden) return;
    var e = W.e;
    if (T - baroT > 1) { baroT = T; baroHist.push(e); if (baroHist.length > 3600) baroHist.shift(); var past = baroHist[Math.max(0, baroHist.length - 3600)];
      baroN.style.transform = 'rotate(' + (50 - Math.min(1, e * 1.6) * 155 + Math.sin(T * 3) * e * 4).toFixed(1) + 'deg)'; baroR.style.transform = 'rotate(' + (50 - Math.min(1, past * 1.6) * 155).toFixed(1) + 'deg)';
      if (ISLAND) { var sh = ISLAND.world.shells; jarN.textContent = sh; jarFill.style.height = Math.min(100, sh / 10) + '%'; }
      if (ISLAND) ISLAND.events.slice(0, 6).reverse().forEach(function (ev) { var key = ev.at + ev.msg; if (!tapeSeen[key]) { tapeSeen[key] = 1; tapePrint(ev.msg); } }); }
    var roll = Math.sin(T * (1.2 + e)) * (3 + e * 18), bob = Math.sin(T * 1.7) * (1 + e * 4);
    btShip.setAttribute('transform', 'translate(0 ' + bob.toFixed(1) + ') rotate(' + roll.toFixed(1) + ' 75 64)');
    btW1.setAttribute('d', waveD(66, 2 + e * 7, T * 2, .06)); btW2.setAttribute('d', waveD(72, 1.5 + e * 6, -T * 2.4, .08));
  }
  setTimeout(function () { tapePrint('tape loaded. the harbour is listening'); }, 1500);
  var oldSay = say; say = function (kind, txt) { oldSay(kind, txt); if (/^(land|sunk|rescue|mer|storm|helm|deck|ashore)/.test(kind)) tapePrint(txt); };
  var seisC = document.getElementById('seis-c').getContext('2d'), seisLed = document.getElementById('seis-led'), seisW = document.getElementById('seis-w');
  function thingsTick(dt) {
    if (!DL.drag) { var acc2 = -2 * .16 * 9 * DL.v - 81 * DL.a; DL.v += acc2 * dt; DL.a += DL.v * dt; }
    knurl.style.setProperty('--a', DL.a.toFixed(2) + 'deg'); dialR.textContent = (DL.a >= 0 ? '+' : '') + DL.a.toFixed(1) + '°'; dial.setAttribute('aria-valuenow', Math.round(DL.a));
    if (wins.things.hidden) return;
    seisC.fillStyle = '#08100B'; seisC.fillRect(0, 0, 224, 88);
    seisC.fillStyle = 'rgba(0,166,81,.18)'; for (var i = 0; i < 224; i += 16) seisC.fillRect(i, 0, 1, 88); for (var j = 0; j < 88; j += 22) seisC.fillRect(0, j, 224, 1);
    seisC.fillStyle = '#3BF08F';
    var hst = W.hist, n = hst.length; for (var k = 0; k < n; k++) { var py = Math.round(48 - Math.max(-38, Math.min(38, hst[k] * 22))); seisC.fillRect(224 - (n - k) * 1.56, py, 2, 2); }
    seisLed.classList.toggle('on', W.e > .3 || (T % 2 < .08));
    seisW.textContent = weatherWord(W.e).toUpperCase() + ' · ' + W.e.toFixed(2);
  }

  /* ---------- the island: a small economy under open sky ----------
     SEA       the outside world. Live market moves become wind, waves and storms. Nobody here knows the next hour.
     FISH      shoals grow on a logistic curve, scatter in storms and can be fished out. Real, but finite.
     WOOD      forest on the slopes, driftwood the current brings ashore. Capital you spend and must regrow.
     VILLAGE   houses fed from one shared store. Empty store, dark houses.
     CAPTAINS  five fishing boats, five temperaments. Same sea, different results.
     HARBOUR   shared by every visitor (Supabase): the store, expeditions, the island's ledger. */
  var lifeC = document.getElementById('life'), lx = lifeC.getContext('2d'), glyphC = document.getElementById('glyph'), gx = glyphC.getContext('2d');
  var DPR = 1;
  function lifeResize() { DPR = Math.min(2, devicePixelRatio || 1); [lifeC, glyphC].forEach(function (c) { c.width = Math.round(innerWidth * DPR); c.height = Math.round(innerHeight * DPR); }); }
  addEventListener('resize', lifeResize); lifeResize();

  // camera: orbits the island, chases your boat, or looks through your eyes (at the wheel, on deck, ashore)
  var CV = { a: .7, d: 4.4, tx: 0, tz: 0, h: 1.35, ox: .3, ro: null, ta: null }, CAM = null;
  function angLerp(a, b, k) { var d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; }
  function watJS(x, z) { var a = .01 + W.e * .06; return a * (Math.sin(x * 7 + T * 1.3) + Math.sin(z * 9 - T * 1.1 + x * 2) + .5 * Math.sin((x + z) * 15 + T * 2.3)); }
  var BOATL = .22;
  function boatY(x, z) { return (watJS(x, z) + watJS(x + .04, z) + watJS(x, z + .04)) / 3; }
  function camera(T, M) {
    var ro, ta, ox = 0, first = HELM.mode !== 'off' && HELM.cam === 'first', fast = isFast();
    if (HELM.mode === 'off' || HELM.cam === 'third') {
      var k = .06, tx = 0, tz = 0, a, d, h;
      if (HELM.mode === 'off') { a = .7 + T * .02 + M[0] * .5; d = 4.4; h = 1.35 + M[1] * .35; }
      else { var fx = HELM.mode === 'shore' ? HELM.wx : HELM.x, fz = HELM.mode === 'shore' ? HELM.wz : HELM.z; tx = fx; tz = fz; a = Math.atan2(-Math.cos(HELM.yaw), -Math.sin(HELM.yaw)); d = .9; h = .38; k = .1; }
      CV.a = angLerp(CV.a, a, k); CV.d += (d - CV.d) * k; CV.tx += (tx - CV.tx) * (HELM.mode === 'off' ? k : .3); CV.tz += (tz - CV.tz) * (HELM.mode === 'off' ? k : .3); CV.h += (h - CV.h) * k; CV.ox += ((HELM.mode === 'off' ? .3 : 0) - CV.ox) * k;
      ro = [CV.tx + Math.sin(CV.a) * CV.d, CV.h, CV.tz + Math.cos(CV.a) * CV.d]; ta = [CV.tx, HELM.mode === 'off' ? .05 : .03, CV.tz]; ox = CV.ox;
    } else {
      var e = eye(); ro = e; var cp = Math.cos(HELM.pitch); ta = [e[0] + Math.cos(HELM.yaw) * cp, e[1] + Math.sin(HELM.pitch), e[2] + Math.sin(HELM.yaw) * cp];
      CV.ox = 0; CV.tx = HELM.x; CV.tz = HELM.z;
    }
    if (CV.ro && first && CV.wasFirst) { ro = ro.map(function (v, i) { return CV.ro[i] + (v - CV.ro[i]) * .5; }); }
    CV.ro = ro; CV.wasFirst = first;
    var f = [ta[0] - ro[0], ta[1] - ro[1], ta[2] - ro[2]], fl = Math.hypot(f[0], f[1], f[2]); f = [f[0] / fl, f[1] / fl, f[2] / fl];
    var r = [-f[2], 0, f[0]], rl = Math.hypot(r[0], r[2]); r = [r[0] / rl, 0, r[2] / rl];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    CAM = { ro: ro, ta: ta, f: f, r: r, u: u, H: cv.height * SCALE, ox: ox, first: first,
      q: first ? (fast ? 110 : 190) : (fast ? 80 : 120), tn: first ? .004 : (HELM.mode === 'off' ? .5 : .05), st: first ? [.0015, .014] : [.006, 0] };
  }
  // where your eyes are: on deck (boat-local x along the heading, z across), or ashore
  function eye() {
    if (HELM.mode === 'shore') return [HELM.wx, walkH(HELM.wx, HELM.wz) + .034, HELM.wz];
    var c = Math.cos(HELM.hd), s = Math.sin(HELM.hd), lx = HELM.mode === 'wheel' ? -.36 : HELM.lx, lz = HELM.mode === 'wheel' ? 0 : HELM.lz;
    var x = HELM.x + (c * lx - s * lz) * BOATL, z = HELM.z + (s * lx + c * lz) * BOATL;
    return [x, boatY(HELM.x, HELM.z) + .08 * BOATL + .032, z];
  }
  function proj(x, y, z) {
    var c = CAM, px = x - c.ro[0], py = y - c.ro[1], pz = z - c.ro[2];
    var d = px * c.f[0] + py * c.f[1] + pz * c.f[2]; if (d < (c.first ? .01 : .15)) return null;
    var sx = (px * c.r[0] + pz * c.r[2]) / d * 1.9 + c.ox, sy = (px * c.u[0] + py * c.u[1] + pz * c.u[2]) / d * 1.9;
    return [sx * c.H + innerWidth / 2, innerHeight / 2 - sy * c.H, d];
  }
  function placeLighthouse() { var p = proj(LPX, LBH + .29, LPZ); hit.style.display = p && HELM.mode === 'off' ? '' : 'none'; if (p) { hit.style.left = p[0] + 'px'; hit.style.top = (p[1] + 34) + 'px'; } }

  var LAND = [];
  for (var gxi = -1.5; gxi <= 1.5; gxi += .05) for (var gzi = -1.4; gzi <= 1.4; gzi += .05) { var hh = ter(gxi, gzi); if (hh > .02) LAND.push([gxi, gzi]); }
  var LAMP = [LPX, LBH + .33, LPZ];
  function sea(x, z) { return ter(x, z) < -.05; }
  // the harbour sits on the coast below the lighthouse
  var HB = (function () { var dx = .45, dz = .9, l = Math.hypot(dx, dz); dx /= l; dz /= l; for (var r = .3; r < 2.5; r += .02) if (ter(dx * r, dz * r) < -.06) return { x: dx * (r + .1), z: dz * (r + .1), cx: dx * (r - .06), cz: dz * (r - .06), dx: dx, dz: dz }; return { x: 1.5, z: 0, cx: 1.3, cz: 0, dx: 1, dz: 0 }; })();

  // heat map over island and sea: every event leaves heat, heat diffuses and cools
  var HN = 72, HS = 6, HM = new Float32Array(HN * HN), HBF = new Float32Array(HN * HN), hTick = 0;
  function heatAt(x, z, v) { var i = Math.floor((x + HS / 2) / HS * HN), j = Math.floor((z + HS / 2) / HS * HN); if (i < 0 || j < 0 || i >= HN || j >= HN) return; HM[j * HN + i] = Math.min(4, HM[j * HN + i] + v); }
  function heatStep() {
    hTick++; for (var k = 0; k < HM.length; k++) HM[k] *= .972;
    if (hTick % 3) return;
    for (var j = 1; j < HN - 1; j++) for (var i = 1; i < HN - 1; i++) { var o = j * HN + i; HBF[o] = HM[o] * .6 + (HM[o - 1] + HM[o + 1] + HM[o - HN] + HM[o + HN]) * .1; }
    HM.set(HBF);
  }
  function heatRGB(v) { var st = [[8, 41, 26], [0, 166, 81], [204, 237, 92], [240, 245, 214]]; v = Math.max(0, Math.min(1, v)) * 3; var i = Math.min(2, Math.floor(v)), f = v - i; return st[i].map(function (a, k) { return Math.round(a + (st[i + 1][k] - a) * f); }).join(','); }
  var LOG = document.getElementById('sys-log'), logLast = {};
  var fmtS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  function say(kind, txt) {
    var now = performance.now(); if (logLast[kind] && now - logLast[kind] < 2500) return; logLast[kind] = now;
    var d = document.createElement('div'); d.innerHTML = '<span class="t">' + fmtS.format(new Date()) + '</span>' + txt;
    LOG.insertBefore(d, LOG.firstChild); while (LOG.children.length > 5) LOG.lastChild.remove();
  }
  var STAT = { hist: [[], [], [], []] }, PH = { sea: [], eco: [] };

  /* FISH: shoals on a logistic curve. dn/dt = r·n·(1 − n/K) − catch */
  var SHOALS = [];
  for (var si = 0; si < 7; si++) { var sa = si / 7 * 6.283 + h2(si, 2), sr = 1.75 + h2(si, 5) * .8; SHOALS.push({ id: si, x: Math.cos(sa) * sr, z: Math.sin(sa) * sr, n: 20 + h2(si, 9) * 30, K: 60, hd: h2(si, 4) * 6.283, gone: 0 }); }
  function fishTotal() { return SHOALS.reduce(function (s, q) { return s + q.n; }, 0); }
  function shoalStep(dt) {
    SHOALS.forEach(function (s) {
      s.n += .045 * s.n * (1 - s.n / s.K) * dt; if (s.n < .4) s.n = .4;
      s.hd += (n2(s.x * 1.3 + T * .05, s.z * 1.3) - .5) * .08 + (W.e > .4 ? (Math.random() - .5) * .3 : 0);
      var sp = .0012 * (1 + W.e * 5), nx = s.x + Math.cos(s.hd) * sp, nz = s.z + Math.sin(s.hd) * sp, r = Math.hypot(nx, nz);
      if (!sea(nx, nz) || r > 2.9 || r < 1.2) { s.hd += Math.PI * .7; return; }
      s.x = nx; s.z = nz;
    });
  }

  /* CAPTAINS: five temperaments in one sea */
  var CAPT = [
    { name: 'Halima', style: 'careful', note: 'only in calm water, stays near the light' },
    { name: 'Omar', style: 'steady', note: 'goes out unless it is rough' },
    { name: 'Rafi', style: 'bold', note: 'any weather, the biggest shoal' },
    { name: 'Noor', style: 'contrarian', note: 'goes when everyone stays home' },
    { name: 'Sami', style: 'follower', note: 'goes when the last boats came back full' }
  ];
  var lastHauls = [];
  CAPT.forEach(function (c, i) { c.x = HB.x - HB.dz * (i - 2) * .09 + HB.dx * .06; c.z = HB.z + HB.dx * (i - 2) * .09 + HB.dz * .06; c.hd = Math.atan2(HB.dz, HB.dx); c.st = 'dock'; c.t = 2 + i * 3; c.hold = 0; c.trips = 0; c.catch = 0; c.lost = 0; c.tl = []; });
  function inBeam(x, z) { var ph = Math.atan2(z - LPZ, x - LPX); for (var s = 0; s < 2; s++) { var d = Math.abs(((ph - (T * .8 + s * Math.PI)) % 6.283 + 9.425) % 6.283 - 3.1416); if (d < .3) return true; } return Math.hypot(x - LPX, z - LPZ) < .7; }
  function wantsOut(c) {
    var e = W.e, docked = CAPT.filter(function (q) { return q.st === 'dock'; }).length;
    if (c.style === 'careful') return e < .12;
    if (c.style === 'steady') return e < .35;
    if (c.style === 'bold') return true;
    if (c.style === 'contrarian') return docked >= 3;
    var avg = lastHauls.length ? lastHauls.reduce(function (a, b) { return a + b; }, 0) / lastHauls.length : 10; return avg > 9;
  }
  function pickShoal(c) {
    var best = null, bs = -1;
    SHOALS.forEach(function (s) { var d = Math.hypot(s.x - c.x, s.z - c.z), crowd = CAPT.filter(function (q) { return q !== c && q.tgt === s && q.st !== 'dock'; }).length, sc;
      if (c.style === 'careful') { if (Math.hypot(s.x - LPX, s.z - LPZ) > 1.9) return; sc = s.n / (1 + d * 2); }
      else if (c.style === 'bold') sc = s.n;
      else if (c.style === 'contrarian') sc = s.n / (1 + crowd * 3) / (1 + d);
      else sc = s.n / (1 + d);
      if (sc > bs) { bs = sc; best = s; } });
    return best;
  }
  function steer(o, tx, tz, sp) {
    var want = Math.atan2(tz - o.z, tx - o.x); o.hd = angLerp(o.hd, want, .12);
    for (var k = 0; k < 7; k++) { var nx = o.x + Math.cos(o.hd) * sp, nz = o.z + Math.sin(o.hd) * sp; if (sea(nx, nz) || Math.hypot(nx - HB.x, nz - HB.z) < .12) { o.x = nx; o.z = nz; return; } o.hd += .45; }
  }
  function captStep(dt) {
    CAPT.forEach(function (c) {
      c.t -= dt;
      if (c.st === 'dock') { if (c.t <= 0) { if (wantsOut(c)) { c.tgt = pickShoal(c); if (c.tgt) { c.st = 'out'; say('cap' + c.name, c.name + ' (' + c.style + ') went out'); } } c.t = 4; } return; }
      if (c.st === 'sunk') { if (c.t <= 0) { c.st = 'dock'; c.x = HB.x; c.z = HB.z; c.t = 10; c.saved = false; } return; }
      var sp = .006 * (1 - W.e * .45);
      if (c.st === 'out') { if (!c.tgt) { c.st = 'home'; return; } steer(c, c.tgt.x, c.tgt.z, sp); if (Math.hypot(c.tgt.x - c.x, c.tgt.z - c.z) < .1) { c.st = 'fish'; c.t = 5 + Math.random() * 4; } }
      else if (c.st === 'fish') { var take = Math.min(c.tgt.n * .03, 20 - c.hold, .9); c.tgt.n -= take; c.hold += take; heatAt(c.x, c.z, .05); c.x += Math.cos(T + c.hd) * .0006; if (c.t <= 0 || c.hold >= 19.5 || c.tgt.n < 3) c.st = 'home'; if (c.style === 'careful' && W.e > .25) c.st = 'home'; }
      else if (c.st === 'home') { steer(c, HB.x, HB.z, sp); if (Math.hypot(HB.x - c.x, HB.z - c.z) < .08) { c.trips++; c.catch += c.hold; lastHauls.push(c.hold); if (lastHauls.length > 4) lastHauls.shift(); say('land' + c.name, c.name + ' landed ' + Math.round(c.hold) + ' fish'); heatAt(HB.x, HB.z, .4); c.hold = 0; c.st = 'dock'; c.t = 6 + Math.random() * 6; c.tgt = null; } }
      // the sea decides: storms sink boats, the beam and the harbour protect them
      if (c.st !== 'dock' && c.st !== 'sunk') { var p = Math.pow(Math.max(0, W.e - .3), 2) * .03 * (c.style === 'bold' ? 1.3 : 1) * (inBeam(c.x, c.z) ? .35 : 1);
        if (Math.random() < p) { c.st = 'sunk'; c.t = 40; c.lost++; c.hold = 0; heatAt(c.x, c.z, 2.5); say('sunk', c.name + '\'s boat went down. the crew is in the water'); if (soundOn) sfx('close'); } }
      c.tl.push(c.x, c.z); if (c.tl.length > 24) c.tl.splice(0, 2);
    });
  }

  /* DRIFT: wood on the current; storms bring more of it ashore */
  var DR = [];
  function driftStep() {
    if (DR.length < 50 && Math.random() < .04 + W.e * .5) { var a0 = Math.random() * 6.283, r0 = 2.4 + Math.random() * .4; DR.push({ x: Math.cos(a0) * r0, z: Math.sin(a0) * r0, l: 1 }); }
    for (var k = DR.length - 1; k >= 0; k--) { var d = DR[k], rr = Math.hypot(d.x, d.z) || 1, sp = .002 + W.e * .012, w = n2(d.x * 1.7 + T * .1, d.z * 1.7) - .5;
      d.x += (-d.z / rr * .8 - d.x / rr * (.35 + w)) * sp; d.z += (d.x / rr * .8 - d.z / rr * (.35 - w)) * sp; d.l -= .001;
      if (!sea(d.x, d.z)) { DR.splice(k, 1); heatAt(d.x, d.z, .5); WOODLOCAL++; continue; } if (d.l <= 0) DR.splice(k, 1); }
  }
  var WOODLOCAL = 0;

  /* FOREST and VILLAGE: the forest grows on the slopes by itself; houses and planted trees are shared */
  var FOREST = [];
  LAND.forEach(function (l, i) { var h = ter(l[0], l[1]); if (h > .06 && h < .32 && h2(l[0] * 7, l[1] * 7) > .62) FOREST.push({ x: l[0] + (h2(i, 1) - .5) * .04, z: l[1] + (h2(i, 3) - .5) * .04, s: .6 + h2(i, 5) * .6 }); });
  var MARKS = [];

  /* HELM: your boat. Take the wheel, walk the deck, step ashore. */
  var HELM = { on: false, mode: 'off', cam: 'first', x: HB.x, z: HB.z, hd: Math.atan2(HB.dz, HB.dx), v: 0, nets: 0, keys: {}, tl: [], saved: 0, landed: 0, lastLand: 0,
    yaw: Math.atan2(HB.dz, HB.dx), pitch: -.08, lx: 0, lz: 0, wx: HB.cx, wz: HB.cz };
  var hud = document.getElementById('helm'), hudSp = document.getElementById('helm-sp'), hudNet = document.getElementById('helm-net'), hudHd = document.getElementById('helm-hd'), hudMsg = document.getElementById('helm-msg'), hudMode = document.getElementById('helm-mode');
  function setMode2(m) {
    HELM.mode = m; HELM.on = m !== 'off'; document.body.classList.toggle('helming', HELM.on); hud.hidden = !HELM.on;
    if (m === 'off' && document.pointerLockElement) document.exitPointerLock();
    hudMode.textContent = m === 'wheel' ? 'at the wheel' : m === 'deck' ? 'on deck' : m === 'shore' ? 'ashore' : '';
  }
  function helm(on) {
    var go = on === undefined ? HELM.mode === 'off' : on;
    if (go) { if (Math.hypot(HELM.x - HB.x, HELM.z - HB.z) > 3) { HELM.x = HB.x; HELM.z = HB.z; } HELM.yaw = HELM.hd; HELM.pitch = -.08; setMode2('wheel'); say('helm', 'you took the wheel'); }
    else setMode2('off');
  }
  // the walkable ground: the island, and the pier
  function onPier(x, z) { var ax = HB.cx, az = HB.cz, bx = HB.x, bz = HB.z, vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - ax - vx * t, z - az - vz * t) < .035; }
  function walkH(x, z) { return onPier(x, z) ? Math.max(ter(x, z), .025) : ter(x, z); }
  function walkable(x, z) { return onPier(x, z) || ter(x, z) > -.02; }
  function deckOK(lx, lz) { if (lx < -.46 || lx > .44) return false; var tp = Math.max(0, Math.min(1, (lx + .1) / .6)), w = .15 * (1 - tp * tp * .9); if (Math.abs(lz) > w) return false; return !(lx > -.13 && lx < .09 && Math.abs(lz) < .11); }
  addEventListener('keydown', function (e) {
    if (/input|textarea/i.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    var k = e.key.toLowerCase();
    if (k === 'h' && document.getElementById('boot').classList.contains('done')) { helm(); e.preventDefault(); return; }
    if (!HELM.on) return;
    if (k === 'escape') { if (!document.pointerLockElement) setMode2('off'); e.stopPropagation(); return; }
    if (k === 'e') { toggleWheel(); e.stopPropagation(); return; }
    if (k === 'c') { HELM.cam = HELM.cam === 'first' ? 'third' : 'first'; e.stopPropagation(); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].indexOf(k) >= 0) { HELM.keys[k] = true; e.preventDefault(); e.stopPropagation(); }
  }, true);
  addEventListener('keyup', function (e) { HELM.keys[e.key.toLowerCase()] = false; });
  document.getElementById('helm-x').addEventListener('click', function () { setMode2('off'); });
  function toggleWheel() {
    if (HELM.mode === 'wheel') { HELM.lx = -.36; HELM.lz = .07; setMode2('deck'); say('deck', 'you left the wheel'); return; }
    if (HELM.mode === 'deck') { setMode2('wheel'); HELM.yaw = HELM.hd; return; }
    if (HELM.mode === 'shore') { if (Math.hypot(HELM.wx - HELM.x, HELM.wz - HELM.z) < .2) { HELM.lx = .3; HELM.lz = 0; setMode2('deck'); say('board', 'you came aboard'); } else toast('your boat is too far. <b>walk to it</b>'); }
  }
  // look around: pointer lock when you click the world, or drag
  var looking = false;
  addEventListener('mousemove', function (e) { if (!HELM.on) return; if (document.pointerLockElement || looking) { HELM.yaw += e.movementX * .0028; HELM.pitch = Math.max(-1.2, Math.min(1.1, HELM.pitch - e.movementY * .0028)); } });
  addEventListener('pointerdown', function (e) { if (!HELM.on || e.target.closest('.helm, .win, .menubar')) return; looking = true; if (!document.pointerLockElement && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (er) {} } });
  addEventListener('pointerup', function () { looking = false; });
  function helmStep() {
    var K = HELM.keys, fw = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0), side = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0), run = K.shift ? 2 : 1;
    var atWheel = HELM.mode === 'wheel', thr = atWheel ? (fw > 0 ? 1 : fw < 0 ? -.6 : 0) : 0, turn = atWheel ? side : 0;
    var oldHd = HELM.hd;
    HELM.v += thr * .0011 - HELM.v * .035; HELM.v = Math.max(-.008, Math.min(.024, HELM.v));
    HELM.hd += turn * (.03 + Math.abs(HELM.v) * 1.6) + (Math.random() - .5) * W.e * .03;
    var nx = HELM.x + Math.cos(HELM.hd) * HELM.v, nz = HELM.z + Math.sin(HELM.hd) * HELM.v;
    if (sea(nx, nz) || Math.hypot(nx - HB.x, nz - HB.z) < .15) { HELM.x = nx; HELM.z = nz; } else HELM.v *= -.3;
    if (Math.hypot(HELM.x, HELM.z) > 3.4) HELM.hd += .2;
    if (HELM.mode === 'wheel' || HELM.mode === 'deck') HELM.yaw += HELM.hd - oldHd; // you turn with the boat
    // walking: on deck in the boat's frame, ashore on the ground
    if ((HELM.mode === 'deck' || HELM.mode === 'shore') && (fw || side)) {
      var sp = .0024 * run, dx = Math.cos(HELM.yaw) * fw - Math.sin(HELM.yaw) * side, dz = Math.sin(HELM.yaw) * fw + Math.cos(HELM.yaw) * side, dl = Math.hypot(dx, dz) || 1; dx = dx / dl * sp; dz = dz / dl * sp;
      if (HELM.mode === 'deck') {
        var c = Math.cos(HELM.hd), s = Math.sin(HELM.hd), lx = HELM.lx + (dx * c + dz * s) / BOATL, lz = HELM.lz + (-dx * s + dz * c) / BOATL;
        if (deckOK(lx, lz)) { HELM.lx = lx; HELM.lz = lz; }
        else if (deckOK(lx, HELM.lz)) HELM.lx = lx; else if (deckOK(HELM.lx, lz)) HELM.lz = lz;
        else { // over the rail: ashore if there is ground there
          var wx = HELM.x + (c * lx - s * lz) * BOATL, wz = HELM.z + (s * lx + c * lz) * BOATL;
          if (walkable(wx, wz)) { HELM.wx = wx; HELM.wz = wz; setMode2('shore'); say('ashore', 'you stepped ashore'); }
        }
      } else { var tx = HELM.wx + dx, tz = HELM.wz + dz; if (walkable(tx, tz)) { HELM.wx = tx; HELM.wz = tz; } else if (walkable(tx, HELM.wz)) HELM.wx = tx; else if (walkable(HELM.wx, tz)) HELM.wz = tz; }
    }
    if (!HELM.on) return;
    var msg = '';
    if (HELM.mode !== 'shore') {
      // fishing: slow over a shoal and the nets fill
      SHOALS.forEach(function (q) { if (Math.hypot(q.x - HELM.x, q.z - HELM.z) < .2) { if (Math.abs(HELM.v) < .012 && HELM.nets < 25) { var t = Math.min(q.n * .02, 25 - HELM.nets, .5); q.n -= t; HELM.nets += t; heatAt(HELM.x, HELM.z, .08); msg = 'fishing… slow is good'; } else if (HELM.nets < 25) msg = 'shoal below. slow down to fish'; } });
      CAPT.forEach(function (cp) { if (cp.st === 'sunk' && !cp.saved && Math.hypot(cp.x - HELM.x, cp.z - HELM.z) < .14) { cp.saved = true; cp.t = 3; HELM.saved++; heatAt(cp.x, cp.z, 1.5); toast('you pulled <b>' + cp.name + '</b>\'s crew out of the water'); say('rescue', 'you rescued ' + cp.name + '\'s crew'); } });
      if (Math.hypot(HB.x - HELM.x, HB.z - HELM.z) < .2 && HELM.nets >= 1 && T - HELM.lastLand > 3) { HELM.lastLand = T; var n = Math.round(HELM.nets); HELM.nets = 0; HELM.landed += n; landCatch(n); }
      if (W.e > .6 && Math.abs(HELM.v) > .016 && Math.random() < .006) { HELM.nets = 0; HELM.v = 0; HELM.x = HB.x; HELM.z = HB.z; toast('capsized. <b>the sea was louder than your engine</b>'); say('cap', 'you capsized and swam home'); }
    } else msg = Math.hypot(HELM.wx - HELM.x, HELM.wz - HELM.z) < .2 ? 'E to come aboard' : 'walking the island. Shift to run';
    HELM.tl.push(HELM.x, HELM.z); if (HELM.tl.length > 60) HELM.tl.splice(0, 2);
    hudSp.textContent = (Math.abs(HELM.v) * 600).toFixed(1) + ' kn'; hudNet.textContent = Math.floor(HELM.nets) + ' / 25';
    hudHd.textContent = String(Math.round(((90 - HELM.hd * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0') + '°';
    hudMsg.textContent = msg || (HELM.mode === 'deck' ? 'walk the deck. over the rail near land to step ashore. E for the wheel' : HELM.nets >= 25 ? 'nets full. take it to the harbour' : HELM.nets >= 1 ? 'the harbour buys your catch' : W.e > .5 ? 'rough sea. go easy on the throttle' : 'find a shoal (the bright dots)');
  }

  // every boat in the world is real geometry in the shader: yours, the captains', merchants, expeditions
  var BP = new Float32Array(40), BQ = new Float32Array(40);
  function boatsUniform() {
    var list = [], cam = CAM.ro;
    list.push({ x: HELM.x, z: HELM.z, hd: HELM.hd, k: 3, s: 1, mine: 1, y: 0 });
    CAPT.forEach(function (c) { if (c.st === 'sunk' && c.t < 30) return; list.push({ x: c.x, z: c.z, hd: c.hd, k: 1, s: .9, mine: 0, y: c.st === 'sunk' ? -.035 : 0 }); });
    MER.forEach(function (m) { list.push({ x: m.x, z: m.z, hd: m.hd, k: 2, s: 1.7, mine: 0, y: 0 }); });
    if (ISLAND) ISLAND.ships.forEach(function (sh) { var p = shipPos(sh); if (Math.hypot(p.x, p.z) < 3.6) list.push({ x: p.x, z: p.z, hd: p.hd, k: 2, s: 1.3, mine: sh.mine ? 1 : 0, y: 0 }); });
    list.forEach(function (b) { b.dd = Math.hypot(b.x - cam[0], b.z - cam[2]) - (b.mine ? 9 : 0); });
    list.sort(function (a, b) { return a.dd - b.dd; });
    var n = isFast() ? 5 : 10; BP.fill(0); BQ.fill(0);
    for (var i = 0; i < Math.min(n, list.length); i++) { var b = list[i]; BP[i * 4] = b.x; BP[i * 4 + 1] = boatY(b.x, b.z) + b.y; BP[i * 4 + 2] = b.z; BP[i * 4 + 3] = b.hd; BQ[i * 4] = b.k; BQ[i * 4 + 1] = b.s; BQ[i * 4 + 2] = b.mine; }
    gl.uniform4fv(uBp, BP); gl.uniform4fv(uBq, BQ);
  }

  /* MERCHANTS: when the store has surplus fish, ships come from the horizon */
  var MER = [];
  function merchantStep() {
    var surplus = ISLAND && ISLAND.world.fish > 150;
    if (surplus && MER.length < 2 && Math.random() < .002) { var a = Math.random() * 6.283; MER.push({ x: Math.cos(a) * 3.3, z: Math.sin(a) * 3.3, hd: a + Math.PI, st: 'in', t: 0 }); say('mer', 'a merchant is coming for the surplus fish'); }
    for (var i = MER.length - 1; i >= 0; i--) { var m = MER[i];
      if (m.st === 'in') { steer(m, HB.x, HB.z, .007); if (Math.hypot(HB.x - m.x, HB.z - m.z) < .15) { m.st = 'wait'; m.t = 6; heatAt(HB.x, HB.z, 1); } }
      else if (m.st === 'wait') { m.t -= 1 / 30; if (m.t <= 0) { m.st = 'out'; m.hd += Math.PI; say('mer2', 'the merchant left with fish, the store got shells'); } }
      else { m.x += Math.cos(m.hd) * .008; m.z += Math.sin(m.hd) * .008; if (Math.hypot(m.x, m.z) > 3.6) MER.splice(i, 1); } }
  }

  /* SHARED: the harbour, the store and the ledger live in Supabase, one island for everyone */
  var SB = { url: 'https://ggdxnznxaviugnkjsyiz.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnZHhuem54YXZpdWdua2pzeWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MDQ4MjUsImV4cCI6MjEwOTE4MDgyNX0.Qd7X-8C2rl1tTd30Vn801Fo_WagQE-7_pmfFXHPaiik' };
  var SAILOR = null; try { SAILOR = localStorage.getItem('bentlik-who'); } catch (e) {}
  if (!SAILOR || !/^[a-z0-9]{6,16}$/.test(SAILOR)) { SAILOR = ''; for (var wi = 0; wi < 10; wi++) SAILOR += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]; try { localStorage.setItem('bentlik-who', SAILOR); } catch (e) {} }
  var ISLAND = null, ONLINE = false, SKEW = 0, seenEv = null, pulling = false;
  function rpc(fn, args) { return fetch(SB.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function pull() {
    if (pulling || document.hidden) return; pulling = true;
    rpc('island_state', { p_who: SAILOR, p_weather: +W.e.toFixed(3) }).then(function (s) {
      pulling = false; ISLAND = s; ONLINE = true; SKEW = new Date(s.now).getTime() - Date.now();
      MARKS = s.marks.map(function (m) { return { kind: m.kind, x: +m.x, z: +m.z, alive: m.alive, id: m.id }; });
      var myName = s.me && s.me.name;
      if (seenEv !== null && myName) s.events.forEach(function (e) { var t = new Date(e.at).getTime(); if (t > seenEv && e.msg.indexOf(myName) === 0 && (e.kind === 'back' || e.kind === 'lost')) { toast(e.kind === 'back' ? '<b>your ship came home.</b> ' + e.msg.split(': ')[1] : '<b>your ship was lost.</b> the sea keeps the cargo'); if (e.kind === 'back') bell(); } });
      if (s.events.length) seenEv = Math.max(seenEv || 0, new Date(s.events[0].at).getTime());
      harbourRender();
    }).catch(function () { pulling = false; ONLINE = false; harbourRender(); });
  }
  function landCatch(n) {
    if (!ONLINE) { toast('landed ' + n + ' fish. <b>the harbour is offline</b>, the island keeps them locally'); return; }
    rpc('land_catch', { p_who: SAILOR, p_fish: n }).then(function (r) { toast(r.ok ? 'the harbour bought <b>' + r.fish + ' fish</b>. the whole island eats better' : r.why); if (r.ok) { bell(); pull(); } }).catch(function () { toast('the harbour did not answer'); });
  }
  function build(kind, x, z) {
    if (!ONLINE) { toast('the harbour is offline. <b>nothing to build with</b>'); return; }
    MARKS.push({ kind: kind, x: x, z: z, alive: true, pending: true }); heatAt(x, z, 2);
    rpc('build', { p_who: SAILOR, p_kind: kind, p_x: +x.toFixed(3), p_z: +z.toFixed(3) }).then(function (r) { toast(r.ok ? (kind === 'house' ? 'a new house. <b>one more mouth to feed</b>' : 'a tree. <b>wood, slowly</b>') : r.why); pull(); });
  }
  function sendShip(cargo, route) {
    if (!ONLINE) { toast('the harbour is offline'); return Promise.resolve(); }
    return rpc('send_ship', { p_who: SAILOR, p_cargo: cargo, p_route: route }).then(function (r) { toast(r.ok ? 'ship out: <b>' + r.cargo + ' shells</b>, ' + route + '. storm risk ' + Math.round(r.storm_p * (route === 'far' ? 160 : 100)) + '%' : r.why); if (r.ok) heatAt(HB.x, HB.z, 1.5); pull(); return r; });
  }
  function bell() { if (!AC || !soundOn) return; var t = AC.currentTime; [880, 1320].forEach(function (f, i) { var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.05 / (i + 1), t); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 1.7); }); }
  pull(); setInterval(pull, 15000); document.addEventListener('visibilitychange', function () { if (!document.hidden) pull(); });
  function shipPos(s) {
    var t0 = new Date(s.launched_at).getTime(), t1 = new Date(s.returns_at).getTime(), now = Date.now() + SKEW, u = Math.max(0, Math.min(1, (now - t0) / (t1 - t0)));
    var R = s.route === 'far' ? 4.6 : 2.9, d = .15 + Math.sin(Math.PI * u) * R, a = s.heading, side = Math.sin(Math.PI * u * 2) * .25;
    return { x: HB.x + Math.cos(a) * d - Math.sin(a) * side, z: HB.z + Math.sin(a) * d + Math.cos(a) * side, hd: a + (u > .5 ? Math.PI : 0), u: u };
  }

  function lifeStep(T) {
    var dt = 1 / 30;
    shoalStep(dt); captStep(dt); driftStep(); helmStep(); merchantStep(); heatStep();
    PH.sea.push([W.x, W.v / W.w0]); if (PH.sea.length > 260) PH.sea.shift();
  }

  /* drawing: everything as small engraved marks on the world */
  var COL = { paper: '207,203,190', green: '0,166,81', lime: '204,237,92', ink: '13,14,11', cream: '240,245,214', deep: '8,41,26' };
  function boatWake(c, tl, rgb, a0) { for (var i = 0; i < tl.length - 2; i += 2) { var p = proj(tl[i], .005, tl[i + 1]); if (!p) continue; c.fillStyle = 'rgba(' + rgb + ',' + (a0 * i / tl.length).toFixed(2) + ')'; c.fillRect(p[0] - .5, p[1] - .5, 1.5, 1.5); } }
  function lifeDraw() {
    var c = lx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    if (!SET.life || !CAM) return;
    var day = SKY.day, night = 1 - day, base = day > .5 ? COL.ink : COL.paper, fed = !ISLAND || ISLAND.world.fish > 0;
    // heat map
    if (SET.heat && !isFast()) { var cw = HS / HN;
      for (var j = 0; j < HN; j++) for (var i = 0; i < HN; i++) { var v = HM[j * HN + i]; if (v < .05) continue;
        var wx = -HS / 2 + (i + .5) * cw, wz = -HS / 2 + (j + .5) * cw, hp = proj(wx, Math.max(ter(wx, wz), 0) + .004, wz); if (!hp) continue;
        var sz = cw * 1.9 * CAM.H / hp[2]; c.fillStyle = 'rgba(' + heatRGB(v * .55) + ',' + Math.min(.7, .12 + v * .4).toFixed(2) + ')'; c.fillRect(hp[0] - sz / 2, hp[1] - sz * .22, sz + .5, sz * .44 + .5); } }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // forest: engraved ink trees
    FOREST.forEach(function (t) { var p = proj(t.x, ter(t.x, t.z), t.z); if (!p) return; var s = Math.max(1, Math.min(CAM.first ? 22 : 3, 3.2 / p[2])) * t.s; c.fillStyle = 'rgba(' + COL.ink + ',.8)'; c.fillRect(p[0] - .5 * s, p[1] - 4 * s, s, 4 * s); c.fillRect(p[0] - 1.5 * s, p[1] - 3 * s, 3 * s, s); c.fillRect(p[0] - s, p[1] - 4.5 * s, 2 * s, s); });
    // shared marks: houses and planted trees
    MARKS.forEach(function (m) { var p = proj(m.x, ter(m.x, m.z), m.z); if (!p) return; var s = Math.max(1, Math.min(CAM.first ? 22 : 3, 3.4 / p[2]));
      if (m.kind === 'tree') { c.fillStyle = 'rgba(' + COL.deep + ',.95)'; c.fillRect(p[0] - .5 * s, p[1] - 4 * s, s, 4 * s); c.fillRect(p[0] - 1.5 * s, p[1] - 3 * s, 3 * s, 1.5 * s); c.fillRect(p[0] - s, p[1] - 5 * s, 2 * s, 1.5 * s); return; }
      c.fillStyle = 'rgba(' + COL.ink + ',' + (m.alive ? .95 : .45) + ')'; c.fillRect(p[0] - 3 * s, p[1] - 4 * s, 6 * s, 4 * s); c.fillRect(p[0] - 2 * s, p[1] - 5.5 * s, 4 * s, 1.5 * s);
      if (m.alive) { c.fillStyle = 'rgba(' + (night > .4 && fed ? COL.lime : COL.paper) + ',' + (fed ? 1 : .35) + ')'; c.fillRect(p[0] - .8 * s, p[1] - 2.8 * s, 1.6 * s, 1.6 * s); }
      if (m.pending) { c.strokeStyle = 'rgba(' + COL.green + ',.9)'; c.strokeRect(p[0] - 5 * s, p[1] - 7 * s, 10 * s, 8 * s); } });
    // the harbour: a pier and a lamp
    var p1 = proj(HB.cx, .02, HB.cz), p2 = proj(HB.x, .02, HB.z);
    if (p1 && p2) { c.strokeStyle = 'rgba(' + COL.paper + ',.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke(); c.lineWidth = 1; c.fillStyle = 'rgb(' + (ONLINE ? COL.green : COL.paper) + ')'; c.fillRect(p2[0] - 1.5, p2[1] - 8, 3, 3); }
    // drift
    c.font = '500 10px "Geist Mono", ui-monospace, monospace';
    DR.forEach(function (d) { var p = proj(d.x, .005, d.z); if (!p) return; c.fillStyle = 'rgba(' + base + ',' + (.25 + .35 * Math.min(1, d.l)).toFixed(2) + ')'; c.fillText('=', p[0], p[1]); });
    // fish shoals: bright dots, more dots, more fish
    SHOALS.forEach(function (s) { var cnt = Math.round(s.n / 3);
      for (var k = 0; k < cnt; k++) { var a = h2(k, s.id) * 6.283 + T * .3 * (k % 2 ? 1 : -1), r = .03 + h2(s.id, k) * .12 * (1 + W.e), fx = s.x + Math.cos(a) * r, fz = s.z + Math.sin(a) * r * .8, p = proj(fx, .01, fz); if (!p) continue;
        var tw = .5 + .5 * Math.sin(T * 3 + k); c.fillStyle = night > .3 ? 'rgba(' + COL.lime + ',' + (.45 + .5 * tw).toFixed(2) + ')' : 'rgba(' + COL.paper + ',' + (.5 + .4 * tw).toFixed(2) + ')'; c.fillRect(p[0] - 1, p[1] - 1, 2, 2); } });
    // captains, their wakes, wrecks
    CAPT.forEach(function (cp) {
      if (cp.st === 'sunk') { var p = proj(cp.x, .01, cp.z); if (!p) return; c.font = '600 12px "Geist Mono", ui-monospace, monospace'; c.fillStyle = 'rgba(' + (cp.saved ? COL.paper : COL.lime) + ',' + (.5 + .5 * Math.sin(T * 6)).toFixed(2) + ')'; c.fillText(cp.saved ? '×' : '!', p[0], p[1] - 4); return; }
      if (!CAM.first) boatWake(c, cp.tl, base, .35);
      var lp = proj(cp.x, .12, cp.z); if (lp && lp[2] < 2.2) { c.font = '500 9px "Geist Mono", ui-monospace, monospace'; c.fillStyle = 'rgba(' + base + ',.75)'; c.fillText(cp.name.toLowerCase() + (cp.hold > 10 ? ' · full' : ''), lp[0], lp[1] - 8); }
    });
    // merchants and expeditions (other visitors' ships too)
    if (ISLAND) ISLAND.ships.forEach(function (s) { var sp = shipPos(s); if (Math.hypot(sp.x, sp.z) >= 3.6) return;
      var p = proj(sp.x, .17, sp.z); if (p && s.mine) { c.font = '500 9px "Geist Mono", ui-monospace, monospace'; c.fillStyle = 'rgb(' + COL.lime + ')'; c.fillText('you', p[0], p[1] - 22); } });
    // your boat
    if (!CAM.first && HELM.v !== 0) boatWake(c, HELM.tl, COL.cream, .6);
    if (HELM.mode === 'shore' && HELM.cam === 'third') { var me = proj(HELM.wx, walkH(HELM.wx, HELM.wz) + .02, HELM.wz); if (me) { c.fillStyle = 'rgb(' + COL.lime + ')'; c.fillRect(me[0] - 2, me[1] - 10, 4, 10); } }
  }

  // click the island to build; click the sea for a ripple
  var bm = document.getElementById('build'), bmAt = null;
  addEventListener('click', function (e) {
    var t = e.target; if (!(t === document.body || t.id === 'world' || t.classList.contains('desk'))) { if (!t.closest('#build')) bm.hidden = true; return; } if (!CAM || HELM.on) return;
    var best = null, bd = 22; LAND.forEach(function (l) { var p = proj(l[0], ter(l[0], l[1]), l[1]); if (!p) return; var d = Math.hypot(p[0] - e.clientX, p[1] - e.clientY); if (d < bd) { bd = d; best = l; } });
    if (best) { bmAt = best; bm.hidden = false; bm.style.left = Math.min(e.clientX + 10, innerWidth - 220) + 'px'; bm.style.top = Math.min(e.clientY + 10, innerHeight - 120) + 'px';
      var w = ISLAND ? ISLAND.world.wood : 0; document.getElementById('bm-wood').textContent = ONLINE ? w + ' wood in the store' : 'harbour offline'; }
    else { bm.hidden = true; ripple(e.clientX, e.clientY); W.v += (Math.random() - .5) * .6; }
  });
  bm.addEventListener('click', function (e) { var b = e.target.closest('[data-build]'); if (!b) return; if (b.dataset.build !== 'no' && bmAt) build(b.dataset.build, bmAt[0] + (Math.random() - .5) * .03, bmAt[1] + (Math.random() - .5) * .03); bm.hidden = true; });
  // type "bentlik": every captain comes home
  var typed = '';
  addEventListener('keydown', function (e) { if (e.key.length !== 1 || HELM.on) return; typed = (typed + e.key.toLowerCase()).slice(-7); if (typed === 'bentlik') { CAPT.forEach(function (c) { if (c.st === 'out' || c.st === 'fish') c.st = 'home'; }); say('home', 'bentlik called. every captain turned home'); } });

  /* HARBOUR window */
  var hv = function (id) { return document.getElementById(id); };
  var harbCargo = hv('hb-cargo'), harbRoute = 'near';
  function harbourRender() {
    hv('hb-dot').className = 'dot ' + (ONLINE ? 'on' : '');
    hv('hb-net').textContent = ONLINE ? 'shared · live' : 'offline';
    if (!ISLAND) return;
    var w = ISLAND.world;
    hv('hb-fish').textContent = w.fish; hv('hb-wood').textContent = w.wood; hv('hb-shells').textContent = w.shells; hv('hb-houses').textContent = w.houses;
    hv('hb-fv').textContent = '1 fish = ' + (+w.fish_value).toFixed(2) + ' shells';
    hv('hb-trees').textContent = w.trees + ' planted trees';
    var risk = +w.storm_p; hv('hb-risk').textContent = (risk * 100).toFixed(1) + '%'; hv('hb-riskbar').style.width = Math.min(100, risk * 100 / .64 * 100) + '%';
    harbCargo.max = Math.max(1, Math.min(200, w.shells)); if (+harbCargo.value > +harbCargo.max) harbCargo.value = harbCargo.max;
    evCalc();
    var ships = ISLAND.ships;
    hv('hb-ships').innerHTML = ships.length ? ships.slice(0, 8).map(function (s) { var left = Math.max(0, (new Date(s.returns_at).getTime() - Date.now() - SKEW) / 1000); return '<div class="' + (s.mine ? 'me' : '') + '"><span>' + (s.mine ? 'you' : s.name) + '</span><span>' + s.route + '</span><span>' + Math.round(s.cargo) + ' sh</span><span>' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0') + '</span></div>'; }).join('') : '<p class="dim">No ships at sea.</p>';
    var me = ISLAND.me || { sent: 0, back: 0, lost: 0, pnl: 0, name: '' };
    hv('hb-me').textContent = me.name + ' · sent ' + me.sent + ' · back ' + me.back + ' · lost ' + me.lost + ' · ' + (me.pnl >= 0 ? '+' : '') + me.pnl + ' shells';
    hv('hb-stats').innerHTML = '<span>peak <b>' + w.peak + '</b></span><span>ships <b>' + w.ships_sent + '</b> · back <b>' + w.ships_back + '</b> · lost <b>' + w.ships_lost + '</b></span><span>best haul <b>+' + w.best_haul + '</b></span><span>worst loss <b>−' + w.worst_loss + '</b></span>';
    hv('hb-log').innerHTML = ISLAND.events.slice(0, 6).map(function (e) { return '<div><span class="t">' + fmtS.format(new Date(e.at)).slice(0, 5) + '</span>' + e.msg + '</div>'; }).join('');
    ledgerDraw();
  }
  function evCalc() {
    if (!ISLAND) return; var w = ISLAND.world, c = +harbCargo.value, far = harbRoute === 'far', p = Math.min(1, +w.storm_p * (far ? 1.6 : 1)), m = far ? 1.7 : 1.25, ev = (1 - p) * m - 1;
    hv('hb-cv').textContent = c + ' shells · ' + Math.round(c / Math.max(1, w.shells) * 100) + '% of store';
    hv('hb-ev').innerHTML = 'Comes home (' + Math.round((1 - p) * 100) + '%): <b>+' + Math.round(c * (m - 1)) + '</b>. Lost (' + Math.round(p * 100) + '%): <b>−' + c + '</b>. Expected: <b class="' + (ev >= 0 ? 'pos' : 'neg') + '">' + (ev >= 0 ? '+' : '') + (c * ev).toFixed(1) + ' (' + (ev >= 0 ? '+' : '') + Math.round(ev * 100) + '%)</b>' + (ev < 0 ? '<br><span class="neg">the odds are against you. a good captain waits.</span>' : '');
  }
  harbCargo.addEventListener('input', evCalc);
  document.querySelectorAll('[data-route]').forEach(function (b) { b.addEventListener('click', function () { harbRoute = b.dataset.route; document.querySelectorAll('[data-route]').forEach(function (q) { q.setAttribute('aria-pressed', String(q === b)); }); evCalc(); }); });
  hv('hb-send').addEventListener('click', function () { var b = hv('hb-send'); b.disabled = true; sendShip(+harbCargo.value, harbRoute).then(function () { setTimeout(function () { b.disabled = false; }, 2000); }); });
  hv('hb-helm').addEventListener('click', function () { helm(true); });
  setInterval(function () { if (ISLAND && !wins.harbour.hidden) harbourRender(); }, 1000);
  var lgC = hv('hb-ledger'), lgX = lgC.getContext('2d');
  function ledgerDraw() {
    var L = ISLAND.ledger.slice(), x = lgX, Wd = lgC.width, Hd = lgC.height; x.fillStyle = '#0D0E0B'; x.fillRect(0, 0, Wd, Hd);
    var w = ISLAND.world, liveEq = +w.shells + +w.fish * +w.fish_value + +w.wood * .5; L.push({ equity: liveEq, drawdown: w.peak > 0 ? 1 - liveEq / w.peak : 0 });
    var mn = Infinity, mx = -Infinity; L.forEach(function (r) { mn = Math.min(mn, +r.equity); mx = Math.max(mx, +r.equity, +w.peak); }); if (mx - mn < 10) { mn -= 5; mx += 5; }
    x.fillStyle = '#34352F'; for (var g = 0; g < 4; g++) x.fillRect(0, Math.round(10 + g * (Hd - 30) / 3), Wd, 1);
    var py = function (v) { return 10 + (1 - (v - mn) / (mx - mn)) * (Hd - 40); }, px = function (i) { return 10 + i / Math.max(1, L.length - 1) * (Wd - 20); };
    x.strokeStyle = '#4A4B44'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, py(+w.peak)); x.lineTo(Wd, py(+w.peak)); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#00A651'; x.lineWidth = 3; x.beginPath(); L.forEach(function (r, i) { if (i) x.lineTo(px(i), py(+r.equity)); else x.moveTo(px(i), py(+r.equity)); }); if (L.length === 1) x.lineTo(Wd - 10, py(+L[0].equity)); x.stroke(); x.lineWidth = 1;
    L.forEach(function (r, i) { var dd = Math.min(1, +r.drawdown * 4); if (dd > .01) { x.fillStyle = 'rgba(204,237,92,' + (.25 + dd * .6).toFixed(2) + ')'; x.fillRect(px(i) - 3, Hd - 22, 6, -dd * 14); } });
    x.font = '500 18px "Geist Mono", ui-monospace, monospace'; x.fillStyle = '#8F8C82'; x.fillText('equity ' + Math.round(liveEq) + '  ·  drawdown ' + Math.max(0, (1 - liveEq / Math.max(1, +w.peak)) * 100).toFixed(1) + '%', 12, Hd - 6);
  }
  // captains' table
  function captRender() {
    if (wins.harbour.hidden) return;
    var rows = CAPT.slice().sort(function (a, b) { return (b.catch - b.lost * 30) - (a.catch - a.lost * 30); });
    hv('hb-capt').innerHTML = rows.map(function (c, i) { return '<div' + (i === 0 ? ' class="lead"' : '') + ' title="' + c.note + '"><span>' + (i === 0 ? '▲ ' : '') + c.name + '</span><span>' + c.style + '</span><span>' + c.trips + '</span><span>' + Math.round(c.catch) + '</span><span>' + c.lost + '</span><span class="st">' + (c.st === 'dock' ? 'in port' : c.st === 'sunk' ? (c.saved ? 'rescued' : 'in the water') : c.st === 'fish' ? 'fishing' : c.st === 'home' ? 'coming home' : 'at sea') + '</span></div>'; }).join('');
  }
  setInterval(captRender, 1000);


  // render: the dither modes run in the shader; glyph, blocks, braille and dots read the analog image back and draw characters
  var pix = null;
  function setMode(id) {
    SET.mode = modeOf(id).id; document.body.classList.toggle('m-cpu', !!modeOf(SET.mode).cpu);
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === SET.mode)); });
    saveSet(); if (window.dispSync) dispSync();
  }
  function saveSet() { try { localStorage.setItem('bentlik-display', JSON.stringify(SET)); } catch (e) {} }
  function cycleMode() { var i = MODES.indexOf(modeOf(SET.mode)); setMode(MODES[(i + 1) % MODES.length].id); say('mode', 'render: ' + modeOf(SET.mode).name.toLowerCase()); }
  var RAMP = ' .·:-=+*%#@', BLOCKS = ' ░▒▓█', BR = [[0, 4], [6, 2], [1, 5], [7, 3]];
  var CPAL = { paper: ['#CFCBBE'], phosphor: ['#CCED5C'], heat: ['#0B6B3A', '#00A651', '#CCED5C', '#F0F5D6'] };
  function cpuPass() {
    var M = modeOf(SET.mode); if (!M.cpu || !gl) return;
    var w = cv.width, h = cv.height; if (!pix || pix.length !== w * h * 4) pix = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    function L(x, y) { var px = Math.min(w - 1, Math.max(0, Math.floor(x / SCALE))), py = Math.min(h - 1, Math.max(0, Math.floor((innerHeight - y) / SCALE))), o = (py * w + px) * 4; return pix[o] / 255; }
    function G(x, y) { var px = Math.min(w - 1, Math.max(0, Math.floor(x / SCALE))), py = Math.min(h - 1, Math.max(0, Math.floor((innerHeight - y) / SCALE))), o = (py * w + px) * 4; return (pix[o + 1] - pix[o]) / 255; }
    var c = gx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = '#0D0E0B'; c.fillRect(0, 0, innerWidth, innerHeight);
    var fs = SET.cell, cw = M.id === 'dots' ? fs : fs * .6, chh = fs, pal = CPAL[SET.pal] || CPAL.paper, glowC = SET.pal === 'heat' ? '#F0F5D6' : '#00A651';
    var bins = pal.map(function () { return []; }), glow = [], paths = pal.map(function () { return new Path2D(); }), gpath = new Path2D();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '500 ' + (M.id === 'braille' ? fs * 1.05 : fs + 1).toFixed(0) + 'px "Geist Mono", ui-monospace, monospace';
    for (var Y = chh / 2; Y < innerHeight; Y += chh) for (var X = cw / 2; X < innerWidth; X += cw) {
      var l = L(X, Y), gg = G(X, Y), bi = Math.min(pal.length - 1, Math.floor(l * pal.length)), isG = gg > .12, ch = '';
      if (M.id === 'glyph') { if (l < .06) continue; ch = RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))]; }
      else if (M.id === 'blocks') { if (l < .08) continue; ch = BLOCKS[Math.min(4, 1 + Math.floor(l * 4))]; }
      else if (M.id === 'braille') { var bits = 0; for (var dy = 0; dy < 4; dy++) for (var dx = 0; dx < 2; dx++) { var sl = L(X - cw / 4 + dx * cw / 2, Y - chh * .375 + dy * chh / 4); if (sl * 1.15 > (BR[dy][dx] + .5) / 8) bits |= [[1, 8], [2, 16], [4, 32], [64, 128]][dy][dx]; } if (!bits) continue; ch = String.fromCharCode(0x2800 + bits); }
      else { if (l < .08) continue; var rad = Math.min(fs * .55, Math.pow(l, .75) * fs * .55), P = isG ? gpath : paths[bi]; P.moveTo(X + rad, Y); P.arc(X, Y, rad, 0, 6.283); continue; }
      if (ch === ' ') continue; (isG ? glow : bins[bi]).push(ch, X, Y);
    }
    if (M.id === 'dots') { paths.forEach(function (P, i) { c.fillStyle = pal[i]; c.fill(P); }); c.fillStyle = glowC; c.fill(gpath); return; }
    bins.forEach(function (arr, i) { c.fillStyle = pal[i]; for (var k = 0; k < arr.length; k += 3) c.fillText(arr[k], arr[k + 1], arr[k + 2]); });
    c.fillStyle = glowC; for (var k2 = 0; k2 < glow.length; k2 += 3) c.fillText(glow[k2], glow[k2 + 1], glow[k2 + 2]);
  }
  // the display window: a tile per mode with a live swatch, sliders, palettes, overlays
  (function () {
    var grid = document.getElementById('mgrid');
    function b2(x, y) { x = Math.floor(x); y = Math.floor(y); var v = x / 2 + y * y * .75; return v - Math.floor(v); }
    function b8(x, y) { return b2(x / 4, y / 4) * .0625 + b2(x / 2, y / 2) * .25 + b2(x, y); }
    var RGB = { ink: [13, 14, 11], paper: [207, 203, 190], lime: [204, 237, 92] };
    function rampRGB(l) { var st = [[13, 14, 11], [8, 41, 26], [0, 166, 81], [204, 237, 92], [240, 245, 214]]; l = Math.max(0, Math.min(1, l)) * 4; var i = Math.min(3, Math.floor(l)), f = l - i; return st[i].map(function (v, k) { return Math.round(v + (st[i + 1][k] - v) * f); }); }
    function swatch(cn, m) {
      var x = cn.getContext('2d'), W2 = cn.width, H2 = cn.height; x.fillStyle = '#0D0E0B'; x.fillRect(0, 0, W2, H2);
      if (m.cpu) { x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '500 9px ui-monospace, monospace'; x.fillStyle = '#CFCBBE';
        for (var yy = 0; yy < H2; yy += 9) for (var xx = 0; xx < W2; xx += (m.id === 'dots' ? 8 : 6)) { var l = xx / W2;
          if (m.id === 'dots') { x.beginPath(); x.arc(xx + 4, yy + 4.5, Math.pow(l, .75) * 4, 0, 6.283); x.fill(); continue; }
          var ch = m.id === 'glyph' ? RAMP[Math.floor(l * RAMP.length)] : m.id === 'blocks' ? BLOCKS[Math.min(4, Math.floor(l * 5))] : String.fromCharCode(0x2800 + [0, 1, 3, 11, 27, 31, 63, 127, 255][Math.floor(l * 9)]);
          x.fillText(ch, xx + 3, yy + 5); } return; }
      var d = x.createImageData(W2, H2);
      for (var y = 0; y < H2; y++) for (var X2 = 0; X2 < W2; X2++) { var lv = X2 / (W2 - 1), th = b8(X2, y) + .004, col;
        if (m.md === 1) th = b2(X2 / 2, y / 2) * .25 + b2(X2, y) + .03; else if (m.md === 2) th = Math.random(); else if (m.md === 3) th = Math.abs((y / 5) % 1 - .5) * 2;
        else if (m.md === 4) { var a1 = Math.abs(((X2 + y) / 7) % 1 - .5) * 2, a2 = Math.abs((((X2 - y) % 7 + 7) % 7) / 7 - .5) * 2; th = (a1 < .9 - lv * 1.05 || (lv < .45 && a2 < .8 - lv * 1.8)) ? 2 : -1; }
        col = m.md === 5 ? rampRGB(Math.floor(Math.max(0, Math.min(1, lv + (b8(X2, y) - .5) * .2)) * 6) / 6) : (lv > th ? RGB.paper : RGB.ink);
        var o = (y * W2 + X2) * 4; d.data[o] = col[0]; d.data[o + 1] = col[1]; d.data[o + 2] = col[2]; d.data[o + 3] = 255; }
      x.putImageData(d, 0, 0);
    }
    MODES.forEach(function (m, i) {
      var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'mt'; bt.dataset.mode = m.id; bt.setAttribute('aria-pressed', 'false');
      bt.innerHTML = '<canvas width="64" height="36" aria-hidden="true"></canvas><span class="mono">' + m.name + '</span>';
      grid.appendChild(bt); swatch(bt.querySelector('canvas'), m);
      bt.addEventListener('click', function () { setMode(m.id); });
    });
    var note = document.getElementById('disp-note');
    function fmtV(k, v) { return k === 'px' ? v + 'px' : k === 'cell' ? v + 'px' : k === 'br' ? (v > 0 ? '+' : '') + (+v).toFixed(2) : (+v).toFixed(2); }
    window.dispSync = function () {
      var M = modeOf(SET.mode);
      document.querySelectorAll('#w-display input[type=range]').forEach(function (inp) { var k = inp.dataset.k; inp.value = SET[k]; inp.nextElementSibling.textContent = fmtV(k, SET[k]);
        inp.closest('.sl').classList.toggle('off', !!((k === 'px' && M.cpu) || (k === 'cell' && !M.cpu) || (k === 'grain' && M.cpu))); });
      document.querySelectorAll('#w-display [data-pal]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pal === SET.pal)); });
      document.querySelectorAll('#w-display [data-ov]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!SET[b.dataset.ov])); });
      document.querySelectorAll('#w-display [data-perf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.perf === SET.perf)); });
      document.body.classList.toggle('bare-life', !SET.life);
      note.textContent = M.name + ' · ' + (M.cpu ? SET.cell + 'px cells' : SCALE + 'px pixels') + ' · ' + SET.pal + (isFast() ? ' · fast' : '');
    };
    document.querySelectorAll('#w-display input[type=range]').forEach(function (inp) {
      inp.addEventListener('input', function () { var k = inp.dataset.k; SET[k] = +inp.value; if (k === 'px') resize(); saveSet(); dispSync(); });
    });
    document.querySelectorAll('#w-display [data-pal]').forEach(function (b) { b.addEventListener('click', function () { SET.pal = b.dataset.pal; saveSet(); dispSync(); }); });
    document.querySelectorAll('#w-display [data-ov]').forEach(function (b) { b.addEventListener('click', function () { SET[b.dataset.ov] = !SET[b.dataset.ov]; saveSet(); dispSync(); }); });
    document.querySelectorAll('#w-display [data-perf]').forEach(function (b) { b.addEventListener('click', function () { SET.perf = b.dataset.perf; saveSet(); resize(); dispSync(); }); });
    document.getElementById('disp-reset').addEventListener('click', function () { Object.keys(DEF).forEach(function (k) { SET[k] = DEF[k]; }); resize(); setMode(SET.mode); toast('display reset. <b>bayer 8, paper</b>'); });
    document.getElementById('sys-disp').addEventListener('click', function () { openWin('display'); });
    setMode(SET.mode);
  })();
  // the systems window: one sparkline per system
  var sparks = Array.prototype.map.call(document.querySelectorAll('.sysrow canvas'), function (cc) { return cc.getContext('2d'); });
  var svs = [0, 1, 2, 3].map(function (i) { return document.getElementById('sv-' + i); });
  var statT = 0;
  function fleetOut() { return CAPT.filter(function (c) { return c.st !== 'dock' && c.st !== 'sunk'; }).length + (ISLAND ? ISLAND.ships.length : 0) + (HELM.on ? 1 : 0); }
  function sysTick(T) {
    if (T - statT < .5) return; statT = T;
    var houses = ISLAND ? ISLAND.world.houses : MARKS.filter(function (m) { return m.kind === 'house' && m.alive; }).length;
    var vals = [W.e, Math.round(fishTotal()), houses, fleetOut()], maxs = [1, 420, 60, 20];
    vals.forEach(function (v, i) { var hs = STAT.hist[i]; hs.push(v); if (hs.length > 60) hs.shift(); });
    if (wins.systems.hidden) return;
    vals.forEach(function (v, i) { svs[i].textContent = i ? String(v) : v.toFixed(2);
      var c = sparks[i], hs = STAT.hist[i]; c.fillStyle = '#121310'; c.fillRect(0, 0, 120, 22); c.fillStyle = '#34352F'; c.fillRect(0, 21, 120, 1);
      c.fillStyle = i === 0 && v > .42 ? '#00A651' : i === 1 ? '#CCED5C' : '#CFCBBE';
      hs.forEach(function (y, k) { var hgt = Math.max(1, Math.round(Math.min(1, y / maxs[i]) * 20)); c.fillRect(k * 2, 21 - hgt, 1, hgt); }); });
  }

  [document.getElementById('sys-q'), document.getElementById('sys-q2')].forEach(function (b) { b.addEventListener('click', function () { var ex = document.getElementById('sys-ex'); ex.hidden = !ex.hidden; document.getElementById('sys-q').setAttribute('aria-expanded', String(!ex.hidden)); wins.systems.style.maxHeight = (innerHeight - wins.systems.offsetTop - 16) + 'px'; }); });
  // phase portraits: the sea spirals back to zero; fish against fishing draws loops (predator and prey)
  var phC = document.getElementById('phase'), phX = phC.getContext('2d'), ecoT = 0;
  function phaseDraw() {
    if (T - ecoT > .25) { ecoT = T; var eff = CAPT.filter(function (c) { return c.st === 'fish' || c.st === 'out'; }).length + (HELM.on ? 1 : 0); PH.eco.push([fishTotal(), eff + Math.random() * .2]); if (PH.eco.length > 300) PH.eco.shift(); }
    if (wins.systems.hidden) return;
    var x = phX, Wd = phC.width, Hd = phC.height, half = Wd / 2; x.fillStyle = '#121310'; x.fillRect(0, 0, Wd, Hd);
    x.fillStyle = '#34352F'; x.fillRect(half, 8, 1, Hd - 16); x.fillRect(16, Hd / 2, half - 32, 1); x.fillRect(half / 2, 16, 1, Hd - 32);
    x.font = '500 16px "Geist Mono", ui-monospace, monospace'; x.fillStyle = '#8F8C82'; x.fillText('SEA  x · v', 12, 24); x.fillText('FISH · BOATS OUT', half + 12, 24);
    var s1 = PH.sea, n1 = s1.length;
    for (var i = 0; i < n1; i++) { var px = half / 2 + Math.max(-1, Math.min(1, s1[i][0] * .55)) * (half / 2 - 18), py = Hd / 2 - Math.max(-1, Math.min(1, s1[i][1] * .55)) * (Hd / 2 - 18);
      x.fillStyle = 'rgba(' + heatRGB(.2 + .8 * i / n1) + ',' + (.15 + .85 * i / n1).toFixed(2) + ')'; x.fillRect(px - 1.5, py - 1.5, 3, 3); }
    var s2 = PH.eco, n2 = s2.length, mnA = 1e9, mxA = 0, mxB = 6; s2.forEach(function (p) { mnA = Math.min(mnA, p[0]); mxA = Math.max(mxA, p[0]); mxB = Math.max(mxB, p[1]); }); if (mxA - mnA < 20) { mnA -= 10; mxA += 10; }
    for (var j = 0; j < n2; j++) { var qx = half + 18 + (s2[j][0] - mnA) / (mxA - mnA) * (half - 36), qy = Hd - 14 - s2[j][1] / mxB * (Hd - 44);
      x.fillStyle = 'rgba(' + heatRGB(.2 + .8 * j / n2) + ',' + (.15 + .85 * j / n2).toFixed(2) + ')'; x.fillRect(qx - 1.5, qy - 1.5, 3, 3); }
  }

  /* ---------- terminal ---------- */
  var tOut = document.getElementById('term-out'), tIn = document.getElementById('term-in'), tHist = [], tHi = 0;
  function tw(txt, cls) { var d = document.createElement('div'); if (cls) d.className = cls; d.textContent = txt; tOut.appendChild(d); document.getElementById('term-body').scrollTop = 1e9; }
  document.getElementById('term-body').addEventListener('click', function () { tIn.focus(); });
  tw('bentlik os terminal. type help.', 'c');
  var CMDS = {
    help: function () { tw('tidy                      put every window back in place\nstatus · store · weather · ships · ledger · captains\nsend <cargo> [near|far]   send a ship from the shared store\nbuild house|tree          build somewhere on the island\nhelm                      take a boat (WASD)\nstorm · calm              push the sea, or calm it\nmode [name]               render: ' + MODES.map(function (m) { return m.id; }).join(' ') + '\npostcard · open <window> · whoami · dogs · clear'); },
    status: function () { CMDS.weather(); CMDS.store(); tw('captains out: ' + CAPT.filter(function (c) { return c.st !== 'dock'; }).length + ' · fish in the sea: ' + Math.round(fishTotal())); },
    weather: function () { tw('sea ' + weatherWord(W.e) + ' · energy ' + W.e.toFixed(2) + ' · ' + (LIVE ? 'live readings' : 'resting signal') + (ISLAND ? ' · storm risk ' + (ISLAND.world.storm_p * 100).toFixed(1) + '%' : '')); },
    store: function () { if (!ISLAND) return tw('harbour offline', 'c'); var w = ISLAND.world; tw('fish ' + w.fish + ' · wood ' + w.wood + ' · shells ' + w.shells + ' · houses ' + w.houses + ' · 1 fish = ' + (+w.fish_value).toFixed(2) + ' shells'); },
    ships: function () { if (!ISLAND) return tw('harbour offline', 'c'); if (!ISLAND.ships.length) return tw('no ships at sea', 'c'); ISLAND.ships.forEach(function (s) { tw((s.mine ? 'you' : s.name) + ' · ' + s.route + ' · ' + Math.round(s.cargo) + ' shells', s.mine ? 'l' : ''); }); },
    ledger: function () { if (!ISLAND) return tw('harbour offline', 'c'); ISLAND.ledger.slice(-7).forEach(function (r) { tw(r.day + '  equity ' + Math.round(r.equity) + '  dd ' + (r.drawdown * 100).toFixed(1) + '%  houses ' + r.houses); }); var m = ISLAND.me; if (m) tw('you: sent ' + m.sent + ' · back ' + m.back + ' · lost ' + m.lost + ' · pnl ' + m.pnl, 'l'); },
    captains: function () { CAPT.forEach(function (c) { tw(c.name.padEnd(7) + c.style.padEnd(11) + 'trips ' + String(c.trips).padEnd(4) + 'fish ' + String(Math.round(c.catch)).padEnd(5) + 'lost ' + c.lost); }); },
    send: function (a) { var c = parseInt(a[0], 10), r = a[1] === 'far' ? 'far' : 'near'; if (!(c > 0)) return tw('usage: send 20 near', 'c'); tw('loading ' + c + ' shells…', 'c'); sendShip(c, r).then(function (x) { if (x) tw(x.ok ? 'ship out. risk ' + Math.round(x.storm_p * (r === 'far' ? 160 : 100)) + '%' : x.why, x.ok ? 'g' : 'c'); }); },
    build: function (a) { var k = a[0] === 'tree' ? 'tree' : 'house', l = LAND[Math.floor(Math.random() * LAND.length)]; build(k, l[0], l[1]); tw('builders sent', 'c'); },
    helm: function () { helm(true); tw('you have the helm. Esc to leave.', 'g'); },
    storm: function () { kick(3); tw('the sea heard you.', 'g'); },
    calm: function () { W.v *= .1; W.x *= .1; tw('…', 'c'); },
    mode: function (a) { if (!a[0]) return tw(MODES.map(function (m) { return (m.id === SET.mode ? '* ' : '  ') + m.id; }).join('\n')); var m = MODES.filter(function (q) { return q.id === a[0]; })[0]; if (!m) return tw('no such mode', 'c'); setMode(m.id); tw('render: ' + m.name, 'g'); },
    postcard: function () { postcard(); tw('developing…', 'c'); },
    open: function (a) { if (wins[a[0]]) { openWin(a[0]); tw('opened ' + a[0], 'c'); } else tw('windows: ' + Object.keys(wins).join(' '), 'c'); },
    whoami: function () { tw((ISLAND && ISLAND.me ? ISLAND.me.name : 'a sailor') + ' on bentlik island. the light is on.'); },
    dogs: function () { tw('badrik   light, mad, fast\nsonechka dark, calm\nbentlik  the first one. keeps the light on.'); },
    bentlik: function () { tw('     ▲\n    ▐█▌   the light is on.\n ~~~▐█▌~~~~~~~~~~~~', 'g'); },
    clear: function () { tOut.innerHTML = ''; },
    fast: function (a) { SET.perf = a[0] === 'off' ? 'full' : a[0] === 'auto' ? 'auto' : 'fast'; saveSet(); resize(); if (window.dispSync) dispSync(); tw('performance: ' + SET.perf, 'g'); },
    tidy: function () { tidy(); tw('windows back in place', 'g'); },
    sudo: function () { tw('nice try. the sea has no root.', 'c'); },
    exit: function () { closeWin(wins.terminal); }
  };
  tIn.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'ArrowUp') { if (tHi > 0) tIn.value = tHist[--tHi]; e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { if (tHi < tHist.length) tIn.value = tHist[++tHi] || ''; e.preventDefault(); return; }
    if (e.key === 'Escape') { tIn.blur(); return; }
    if (e.key !== 'Enter') return;
    var line = tIn.value.trim(); tIn.value = ''; if (!line) return; tHist.push(line); tHi = tHist.length;
    tw('bentlik:~$ ' + line, 'c'); var parts = line.toLowerCase().split(/\s+/), f = CMDS[parts[0]];
    if (f) f(parts.slice(1)); else tw(parts[0] + ': command not found. try help', 'c');
    if (wins.terminal) wins.terminal._h = (wins.terminal._h || 0) + .15;
  });
  new MutationObserver(function () { if (!wins.terminal.hidden) setTimeout(function () { tIn.focus(); }, 50); }).observe(wins.terminal, { attributes: true, attributeFilter: ['hidden'] });

  /* ---------- postcard: the island right now, ready to post ---------- */
  var pcWant = false;
  function postcard() { pcWant = true; }
  document.getElementById('disp-pc').addEventListener('click', postcard);
  function postcardTick() {
    if (!pcWant) return; pcWant = false;
    var W2 = 1200, H2 = 630, c = document.createElement('canvas'); c.width = W2; c.height = H2; var x = c.getContext('2d');
    x.fillStyle = '#0D0E0B'; x.fillRect(0, 0, W2, H2); x.imageSmoothingEnabled = false;
    var src = modeOf(SET.mode).cpu ? glyphC : cv, sw = src.width, sh = src.height, k = Math.max(W2 / sw, H2 / sh);
    x.drawImage(src, (W2 - sw * k) / 2, (H2 - sh * k) / 2, sw * k, sh * k);
    var lk = Math.max(W2 / lifeC.width, H2 / lifeC.height); x.imageSmoothingEnabled = true; x.drawImage(lifeC, (W2 - lifeC.width * lk) / 2, (H2 - lifeC.height * lk) / 2, lifeC.width * lk, lifeC.height * lk);
    x.strokeStyle = '#00A651'; x.lineWidth = 2; x.strokeRect(16, 16, W2 - 32, H2 - 32);
    var d = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    x.fillStyle = 'rgba(13,14,11,.9)'; x.fillRect(32, H2 - 132, 520, 100);
    x.fillStyle = '#E4E1D7'; x.font = '600 28px Geist, ui-sans-serif, sans-serif'; x.fillText('Bentlik', 48, H2 - 92); x.fillStyle = '#00A651'; x.fillText('OS', 48 + x.measureText('Bentlik').width, H2 - 92);
    x.font = '500 15px "Geist Mono", ui-monospace, monospace'; x.fillStyle = '#CFCBBE'; x.fillText(d + ' GST · ' + weatherWord(W.e) + ' at sea', 48, H2 - 64);
    x.fillStyle = '#8F8C82'; x.fillText(ISLAND ? 'fish ' + ISLAND.world.fish + ' · wood ' + ISLAND.world.wood + ' · shells ' + ISLAND.world.shells + ' · houses ' + ISLAND.world.houses : 'the light is on.', 48, H2 - 42);
    x.fillStyle = '#CCED5C'; x.textAlign = 'right'; x.fillText('yurilebedev.com · @Cogit08', W2 - 40, H2 - 42);
    c.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'bentlik-postcard-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('postcard saved. <b>post it, tag @Cogit08</b>'); });
  }

  /* ---------- small things, part two ---------- */
  var toastEl = document.getElementById('toast'), toastT = null;
  function toast(html) { toastEl.innerHTML = html; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2400); }
  // menu words resolve from noise on hover
  var NOISE = '░▒▓#%&*+=-:·01';
  function scramble(el) {
    if (reduced || el.dataset.busy) return; var txt = el.dataset.txt || (el.dataset.txt = el.textContent); el.dataset.busy = 1; var k = 0;
    var iv = setInterval(function () { k++; el.textContent = txt.split('').map(function (ch, i) { return i < k / 2 || ch === ' ' ? ch : NOISE[Math.floor(Math.random() * NOISE.length)]; }).join(''); if (k / 2 >= txt.length) { clearInterval(iv); el.textContent = txt; delete el.dataset.busy; } }, 28);
  }
  document.querySelectorAll('.menubar .item[data-open]').forEach(function (b) {
    var tn = b.firstChild; if (!tn || tn.nodeType !== 3) return; var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = tn.textContent.trim(); b.replaceChild(sp, tn); b.insertBefore(document.createTextNode(''), sp.nextSibling);
    b.addEventListener('pointerenter', function () { scramble(sp); });
  });
  var stateEl = document.getElementById('mb-state'), lastState = 'calm';
  function stateWord(word) { if (word === lastState) return; lastState = word; stateEl.dataset.txt = word; stateEl.textContent = word; scramble(stateEl); document.documentElement.style.setProperty('--pulse', word === 'calm' ? '3s' : word === 'ripple' ? '1.8s' : word === 'swell' ? '1s' : '.45s'); }
  // hold Shift: measure the desktop
  var rh = document.getElementById('rul-h'), rv = document.getElementById('rul-v'), rl = document.getElementById('rul-l'), measuring = false;
  function measure(on) {
    if (on === measuring || small()) return; measuring = on; document.body.classList.toggle('measure', on);
    if (on) Object.keys(wins).forEach(function (k) { var w = wins[k]; w.dataset.dim = w.offsetWidth + ' × ' + w.offsetHeight + '   @ ' + w.offsetLeft + ',' + w.offsetTop + '   heat ' + Math.min(1, w._h || 0).toFixed(2); });
  }
  addEventListener('keydown', function (e) { if (e.key === 'Shift') measure(true); });
  addEventListener('keyup', function (e) { if (e.key === 'Shift') measure(false); });
  addEventListener('blur', function () { measure(false); });
  addEventListener('pointermove', function (e) { if (!measuring) return; rh.style.top = e.clientY + 'px'; rv.style.left = e.clientX + 'px'; rl.style.left = (e.clientX + 8) + 'px'; rl.style.top = (e.clientY + 6) + 'px'; rl.textContent = 'x ' + e.clientX + '  y ' + e.clientY; });
  // ripples where you touch the sea (the island takes a node instead)
  function ripple(x, y) { if (reduced) return; ['', ' r2'].forEach(function (c) { var r = document.createElement('i'); r.className = 'ripple' + c; r.style.left = x + 'px'; r.style.top = y + 'px'; document.body.appendChild(r); setTimeout(function () { r.remove(); }, 1700); }); }
  // the dial clicks as you turn it
  var lastDet = 0;
  function dialTick() { var det = Math.round(DL.a / 10); if (det !== lastDet) { lastDet = det; if (AC && soundOn) { var o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime; o.type = 'square'; o.frequency.value = 2400; g.gain.setValueAtTime(.012, t); g.gain.exponentialRampToValueAtTime(.0001, t + .015); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .02); } } }
  // window frames are a heat map of attention: hover, clicks, scrolling, dragging and the beam warm them; they cool on their own
  var HEATSTOPS = [[52, 53, 47], [8, 90, 50], [0, 166, 81], [204, 237, 92], [240, 245, 214]];
  function frameRGB(v) { v = Math.max(0, Math.min(1, v)) * 4; var i = Math.min(3, Math.floor(v)), f = v - i; return HEATSTOPS[i].map(function (a, k) { return Math.round(a + (HEATSTOPS[i + 1][k] - a) * f); }).join(','); }
  Object.keys(wins).forEach(function (k) { var w = wins[k]; w._h = 0; w._a = -1;
    w.addEventListener('pointermove', function () { w._h += .005; }, { passive: true });
    w.addEventListener('pointerdown', function () { w._h += .22; }); w.addEventListener('wheel', function () { w._h += .03; }, { passive: true });
    w.addEventListener('keydown', function () { w._h += .04; }); });
  function winHeat() {
    Object.keys(wins).forEach(function (k) { var w = wins[k]; if (w.hidden) return; w._h = Math.min(1.2, w._h * .986);
      var v = Math.min(1, w._h); if (Math.abs(v - w._a) < .006) return; w._a = v;
      if (v < .015) { w.style.borderColor = ''; w.style.boxShadow = ''; w.style.removeProperty('--heat'); return; }
      var rgb = frameRGB(v); w.style.borderColor = 'rgb(' + rgb + ')'; w.style.boxShadow = '0 0 ' + Math.round(10 + v * 50) + 'px -10px rgba(' + rgb + ',' + (v * .7).toFixed(2) + ')'; w.style.setProperty('--heat', 'rgb(' + rgb + ')'); });
  }
  // the beam sweeps across the desktop and catches the window frames
  function beamSweep(T) {
    if (!CAM || small()) return;
    var hits = [];
    for (var s2 = 0; s2 < 2; s2++) { var ang = T * .8 + s2 * Math.PI, p2 = proj(LAMP[0] + Math.cos(ang) * 5, LAMP[1] - .25, LAMP[2] + Math.sin(ang) * 5); if (p2) hits.push([0, p2[0]]); }
    Object.keys(wins).forEach(function (k) { var w = wins[k]; if (w.hidden) return; var l = w.offsetLeft, r = l + w.offsetWidth, on = false;
      hits.forEach(function (h) { if (h[1] > l - 20 && h[1] < r + 20) on = true; });
      if (on) w._h += .07; });
  }
  // the dogs walk across the desktop now and then. Badrik runs, Sonechka strolls. Click one.
  var DOGPX = { a: ['#.....#.', '##...##.', '.#####..', '.#.#.#..', '.#####..', '..#.#...', '.#####..', '.#...#..'], b: ['#.....#.', '##...##.', '.#####..', '.#.#.#..', '.#####..', '..#.#...', '.#####..', '..#.#...'] };
  function dogSvg(frame, fill) { return '<svg viewBox="0 0 8 8" aria-hidden="true">' + DOGPX[frame].map(function (row, y) { return row.split('').map(function (ch, x) { return ch === '#' ? '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + fill + '"/>' : ''; }).join(''); }).join('') + '</svg>'; }
  var WHO = [
    { name: 'Badrik', fill: '#E4E1D7', speed: 2.6, lines: ['wuf!', 'zoomies', 'catch me', 'WUF WUF'] },
    { name: 'Sonechka', fill: '#5E5D58', speed: .8, lines: ['…', 'calm down', 'zzz', 'hm.'] }
  ];
  function walk() {
    if (reduced || small() || document.hidden) { setTimeout(walk, 30000); return; }
    var d = WHO[Math.random() < .55 ? 0 : 1], dir = Math.random() < .5 ? 1 : -1, x = dir > 0 ? -40 : innerWidth + 8, el = document.createElement('button');
    el.type = 'button'; el.className = 'walker' + (dir < 0 ? ' flip' : ''); el.setAttribute('aria-label', d.name); el.innerHTML = dogSvg('a', d.fill) + '<span class="say"></span>';
    document.body.appendChild(el); var f = 0, t0 = 0, pause = 0, bub = el.querySelector('.say');
    el.addEventListener('click', function () { bub.textContent = d.lines[Math.floor(Math.random() * d.lines.length)]; el.classList.add('talk'); pause = 50; setTimeout(function () { el.classList.remove('talk'); }, 1400);
      if (d.name === 'Badrik') { kick(1.2); bub.textContent = 'WUF!'; } else { W.v *= .3; } say('dog', d.name + (d.name === 'Badrik' ? ' barked. the sea answered' : ' sat down. the sea calmed')); });
    (function step() {
      if (pause > 0) pause--; else { x += dir * d.speed * (d.name === 'Badrik' ? (1 + .6 * Math.sin(t0 * .3)) : 1); t0++; }
      if (t0 % (d.name === 'Badrik' ? 4 : 9) === 0) { f ^= 1; el.querySelector('svg').outerHTML = dogSvg(f ? 'b' : 'a', d.fill); }
      el.style.transform = 'translateX(' + x.toFixed(1) + 'px)' + (d.name === 'Badrik' ? ' translateY(' + (-Math.abs(Math.sin(t0 * .35)) * 4).toFixed(1) + 'px)' : '');
      if (x < -60 || x > innerWidth + 60) { el.remove(); setTimeout(walk, 40000 + Math.random() * 50000); return; }
      requestAnimationFrame(step);
    })();
  }
  setTimeout(walk, 12000);
  // copying text: a polite note
  document.addEventListener('copy', function () { toast('copied. <b>credit @Cogit08</b> if you post it'); });
  // the konami code: the whole world turns to glyphs for a while, the swarm doubles
  var KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], kp = 0;
  addEventListener('keydown', function (e) { kp = e.key === KON[kp] ? kp + 1 : (e.key === KON[0] ? 1 : 0); if (kp === KON.length) { kp = 0; var prev = SET.mode; setMode('glyph'); SHOALS.forEach(function (q) { q.n = q.K; }); kick(2); toast('<b>cheat accepted.</b> every shoal is full. go fishing (H)'); setTimeout(function () { setMode(prev); }, 12000); } });

  var mb = document.getElementById('menubar'), mbState = document.getElementById('mb-state');
  var wxState = document.getElementById('wx-state'), wxAmp = document.getElementById('wx-amp'), wxLast = document.getElementById('wx-last');
  var wxc = document.getElementById('wx-trace').getContext('2d');
  var last = performance.now(), acc = 0, T = 0;
  function frame(now) {
    var dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    var a = -2 * W.z * W.w0 * W.v - W.w0 * W.w0 * W.x; W.v += a * dt; W.x += W.v * dt;
    if (!LIVE && T > W.next) { kick(.7 + Math.random() * 1.6); W.next = T + 16 + Math.random() * 18; }
    W.e = Math.min(1, Math.hypot(W.x, W.v / W.w0) * .5);
    ms[0] += (mouse[0] - ms[0]) * .03; ms[1] += (mouse[1] - ms[1]) * .03;
    acc += dt;
    if (acc > (isFast() ? 1 / 20 : 1 / 30)) {
      acc = 0;
      // finer dither, but fall back to coarse pixels if this machine can't keep up
      if (SET.perf === 'auto' && !AUTOFAST) { if (dt > .045) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1); if (slowFrames > 40) { AUTOFAST = true; resize(); if (window.dispSync) dispSync(); } }
      // the loupe: a frame that follows the cursor and shows the world without the dither
      lp[0] += (lpT[0] - lp[0]) * .18; lp[1] += (lpT[1] - lp[1]) * .18; lpA += ((lpOn ? 1 : 0) - lpA) * .2;
      placeLoupe();
      if (prog) { if (uLp) { if (lpA > .5 && !HELM.on) { var x0 = (lp[0] - LW / 2) / SCALE, y0 = (innerHeight - lp[1] - LH / 2) / SCALE; gl.uniform4f(uLp, x0, y0, x0 + LW / SCALE, y0 + LH / SCALE); } else gl.uniform4f(uLp, -1, -1, -1, -1); }
        if (uDy) { gl.uniform1f(uDy, SKY.day); gl.uniform1f(uFg, SKY.fog); }
        if (uMd) { gl.uniform1f(uMd, modeOf(SET.mode).md); gl.uniform1f(uCt, SET.ct); gl.uniform1f(uBr, SET.br); gl.uniform1f(uPal, PALS.indexOf(SET.pal)); gl.uniform1f(uGn, SET.grain); }
        camera(T, ms); if (uRo) { gl.uniform3fv(uRo, CAM.ro); gl.uniform3fv(uTa, CAM.ta); gl.uniform1f(uOx, CAM.ox); gl.uniform1f(uQ, CAM.q); gl.uniform1f(uTn, CAM.tn); gl.uniform2f(uSt, CAM.st[0], CAM.st[1]); boatsUniform(); }
        gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, T); gl.uniform1f(uE, W.e); gl.uniform2f(uM, ms[0], ms[1]); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      cpuPass();
      if (!prog) camera(T, ms);
      placeLighthouse();
      if (!reduced) lifeStep(T);
      lifeDraw(); thingsTick(1 / 30); deskTick(); sysTick(T); dialTick(); beamSweep(T); winHeat(); phaseDraw(); postcardTick();
      soundTick(T, W.e);
      drawFav(Math.abs(Math.cos(T * .8 - .9)) > .93);
      W.hist.push(W.x); if (W.hist.length > 144) W.hist.shift();
      var word = weatherWord(W.e);
      titleWeather(word); stateWord(word); wxState.textContent = word; wxAmp.textContent = W.e.toFixed(2);
      if (W.last) wxLast.textContent = 'last tremor ' + fmt.format(W.last);
      // instrument: 1-bit trace
      wxc.fillStyle = '#0D0E0B'; wxc.fillRect(0, 0, 288, 90);
      for (var i = 0; i < 288; i += 8) { wxc.fillStyle = '#34352F'; wxc.fillRect(i, 45, 4, 1); }
      wxc.fillStyle = W.e > .42 ? '#00A651' : '#CFCBBE';
      W.hist.forEach(function (y, k) { var py = Math.round(45 - Math.max(-40, Math.min(40, y * 24))); wxc.fillRect(k * 2, py, 2, 2); });
      // the system shakes on a real impulse, then settles
      var jx = W.e > .45 && Math.random() < W.e * .5 ? ((Math.random() - .5) * 6 * W.e).toFixed(1) + 'px' : '0px';
      document.documentElement.style.setProperty('--jx', jx);
      mb.classList.toggle('slip', jx !== '0px');
    }
    requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  var boot = document.getElementById('boot'), log = document.getElementById('boot-log'), pc = document.getElementById('boot-pc'), msg = document.getElementById('boot-msg');
  var bc = document.getElementById('boot-curve').getContext('2d');
  var LINES = [
    'BENTLIK BIOS 1.0                       (c) 1994-2026',
    '',
    'CPU     one trader, one notebook, three bulldogs',
    'MEMORY  640K ........................... OK',
    'DOS     loading ........................ OK',
    'WIN95   loading ........................ OK',
    'WEB     loading ........................ OK',
    'MARKETS loading ........................ OK',
    ''
  ];
  try {
    var bd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    LINES.splice(LINES.length - 1, 0, 'DATE    ' + bd + ' GST', 'SKY     ' + SKY.word + ', ' + weatherWord(W.e) + ' at sea');
  } catch (e) {}
  var done = false;
  function finish() { if (done) return; done = true; setTimeout(function () { try { if (localStorage.getItem('bentlik-news') === '2') return; localStorage.setItem('bentlik-news', '2'); } catch (e) {} toast('new: <b>the harbour (P)</b> is shared by everyone. <b>H</b> takes a boat'); }, 1800); boot.classList.add('done'); try { sessionStorage.setItem('bentlik-booted', '1'); } catch (e) {} setTimeout(function () { boot.hidden = true; }, 800); }
  document.getElementById('boot-skip').addEventListener('click', finish);
  boot.addEventListener('pointerdown', finish);
  addEventListener('keydown', function () { if (!done) finish(); }, { once: false });
  var seen = false; try { seen = sessionStorage.getItem('bentlik-booted') === '1'; } catch (e) {}
  requestAnimationFrame(frame);
  if (reduced || seen) { finish(); boot.hidden = true; return; }
  var li = 0;
  (function typeLine() {
    if (done) return;
    if (li < LINES.length) { log.textContent += LINES[li++] + '\n'; setTimeout(typeLine, li < 3 ? 160 : 120); return; }
    var t0 = performance.now(), dur = 2000;
    (function draw(now) {
      if (done) return;
      var k = Math.min(1, (now - t0) / dur), wv = bc.canvas.width, hv = bc.canvas.height;
      bc.clearRect(0, 0, wv, hv); bc.fillStyle = '#34352F'; for (var x = 0; x < wv; x += 16) bc.fillRect(x, hv / 2, 8, 2);
      bc.fillStyle = k < 1 ? '#CFCBBE' : '#00A651';
      var n = Math.floor(k * 280);
      for (var i = 0; i <= n; i++) { var s = i / 280, y = Math.exp(-3.4 * s) * Math.sin(2 * Math.PI * 3.2 * s); bc.fillRect(Math.round(s * (wv - 8)), Math.round(hv / 2 - y * (hv / 2 - 8)), 6, 6); }
      pc.textContent = Math.round(k * 100);
      if (k < 1) requestAnimationFrame(draw); else { msg.textContent = 'Equilibrium reached'; setTimeout(finish, 650); }
    })(performance.now());
  })();
})();
