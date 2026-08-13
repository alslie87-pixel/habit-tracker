/* ============================================================
   HABIT TRACKER — PROGRESS PAGE (right-swipe) + ONBOARDING
   Self-contained module. Loaded via <script src="stats.js" defer>
   right before </body>.

   The Progress page is a faithful port of the design handoff
   (design_handoff_habit_stats): nine stacked blocks, committed
   dark palette, Manrope, every chart hand-drawn inline SVG with
   no chart library. Geometry is responsive off a measured content
   width (cw); numbers come from /api/get-stats (real log data).
   ============================================================ */
(function () {
  'use strict';
  const API = '/api';
  const $ = (sel, el) => (el || document).querySelector(sel);

  /* ---------- design tokens ---------- */
  const F = 'Manrope,system-ui,-apple-system,sans-serif';
  const GRN = '#97C459', GLD = '#FAC775', RED = '#F09595', LAV = '#AFA9EC', PUR = '#7F77DD';
  // text ramp: primary → footer
  const T0 = '#F4F3F9', T1 = '#E8E7F0', T2 = '#C9C7D6', T3 = '#8A879B',
        T4 = '#6E6B80', T5 = '#5E5B70', T6 = '#4F4C60', T7 = '#3F3D4D';
  const CARD = '#17171F', CARD_BD = 'rgba(255,255,255,0.055)', DIV = 'rgba(255,255,255,0.045)';

  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const WDL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const YRM = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const MONALL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
                 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  const ORD = [0, 1, 2, 3, 4, 5, 6]; // Monday-start week order

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- Manrope webfont (scoped to this module) ---------- */
  const fl = document.createElement('link');
  fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(fl);

  /* ---------- styles ---------- */
  const css = `
  #stx-panel{position:fixed;inset:0;background:#08080C;z-index:80;
    transform:translateX(100%);transition:transform .28s ease;overflow-y:auto;
    padding:24px 16px 64px;-webkit-overflow-scrolling:touch;box-sizing:border-box}
  #stx-panel.open{transform:translateX(0)}
  .hs-app{width:100%;max-width:560px;margin:0 auto;box-sizing:border-box;
    background:#0D0D12;border:1px solid rgba(255,255,255,0.05);border-radius:22px;
    box-shadow:0 40px 90px -40px rgba(0,0,0,0.9);color:${T1};font-family:${F};
    -webkit-font-smoothing:antialiased}
  .hs-app *{box-sizing:border-box}
  .hs-cards{display:flex;flex-direction:column;gap:14px}
  .hs-card{background:${CARD};border:1px solid ${CARD_BD};border-radius:16px;padding:18px}
  @keyframes hsHalo{0%,100%{opacity:.5}50%{opacity:1}}
  #stx-fab{position:fixed;right:14px;bottom:14px;z-index:70;background:#7F77DD;color:#fff;
    border:none;border-radius:50%;width:44px;height:44px;font-size:18px;cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.4), inset 0 1px 2px rgba(255,255,255,.25), inset 0 -2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
  /* onboarding */
  #obx{position:fixed;inset:0;background:var(--bg-page);z-index:90;overflow-y:auto;
    padding:24px 18px;display:none}
  #obx.show{display:block}
  .obx-wrap{max-width:420px;margin:0 auto}
  .obx-dots{text-align:center;color:var(--text-secondary);font-size:10px;margin-bottom:18px}
  .obx-big{text-align:center;font-size:34px;margin-bottom:10px}
  .obx-t{text-align:center;font-weight:700;font-size:17px;margin-bottom:6px}
  .obx-s{text-align:center;color:var(--text-secondary);font-size:12px;line-height:1.6;margin-bottom:16px}
  .obx-info{border-radius:12px;padding:12px;margin-bottom:10px;background:var(--bg-card)}
  .obx-info b{font-size:12px}
  .obx-info div{font-size:10px;color:var(--text-secondary);margin-top:3px}
  .obx-lbl{font-size:10px;font-weight:600;margin:10px 0 5px 0}
  .obx-item{background:var(--bg-card);border:1px solid var(--border-default);border-radius:10px;
    padding:9px 12px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
  .obx-item input{background:transparent;border:none;color:var(--text-primary);font-size:13px;
    width:100%;outline:none}
  .obx-item.sel{border-color:#639922;background:var(--bg-card-inner)}
  .obx-item.selbad{border-color:#A32D2D;background:var(--bg-card-inner)}
  .obx-btn{display:block;width:100%;background:#7F77DD;border:none;border-radius:12px;
    padding:13px;color:#fff;font-weight:600;font-size:14px;cursor:pointer;margin-top:16px}
  .obx-btn:disabled{opacity:.4}
  .obx-add{border:1px dashed var(--border-default);border-radius:10px;padding:8px;text-align:center;color:var(--text-secondary);font-size:11px;cursor:pointer;margin-bottom:5px}
  .obx-foot{text-align:center;color:var(--text-secondary);font-size:9px;margin-top:10px}`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- state ---------- */
  let S = null;                                   // stats payload
  const V = { mi: 0, open: null, pd: null, sb: null, day: null, cw: 314 };

  const STX_P = 'M6 18V11 M12 18V6 M18 18V14';
  const stxIcon = (size, mainColor) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block">` +
    `<g fill="none" stroke-linecap="round">` +
    `<path d="${STX_P}" stroke="#000" stroke-opacity=".5" stroke-width="3.4" transform="translate(0,0.7)"/>` +
    `<path d="${STX_P}" stroke="#E6E3FF" stroke-opacity=".45" stroke-width="3.4" transform="translate(0,-0.6)"/>` +
    `<path d="${STX_P}" stroke="${mainColor || '#100E24'}" stroke-width="2.9"/>` +
    `</g></svg>`;

  /* ---------- geometry helpers (ported from the handoff) ---------- */
  function smooth(pts) {
    let d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const k = 0.85;
      const c1x = p1.x + (p2.x - p0.x) / 6 * k, c1y = p1.y + (p2.y - p0.y) / 6 * k;
      const c2x = p2.x - (p3.x - p1.x) / 6 * k, c2y = p2.y - (p3.y - p1.y) / 6 * k;
      d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' + c2x.toFixed(1) + ' ' +
        c2y.toFixed(1) + ', ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }
  const pol = (cx, cy, r, a) => { const t = a * Math.PI / 180; return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }; };
  function arcPath(cx, cy, r, a0, a1) {
    const s = pol(cx, cy, r, a0), e = pol(cx, cy, r, a1);
    const la = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return 'M ' + s.x.toFixed(2) + ' ' + s.y.toFixed(2) + ' A ' + r + ' ' + r + ' 0 ' + la +
      ' 1 ' + e.x.toFixed(2) + ' ' + e.y.toFixed(2);
  }

  /* ---------- panel + FAB ---------- */
  const panel = document.createElement('div');
  panel.id = 'stx-panel';
  const app = document.createElement('div');
  app.className = 'hs-app';
  panel.appendChild(app);
  document.body.appendChild(panel);

  const fab = document.createElement('button');
  fab.id = 'stx-fab';
  fab.innerHTML = `<span style="display:flex;align-items:center;justify-content:center">${stxIcon(24)}</span>`;
  fab.title = 'Progress';
  fab.onclick = openPanel;
  document.body.appendChild(fab);

  function openPanel() { panel.classList.add('open'); render(); }
  function closePanel() { panel.classList.remove('open'); }

  /* delegated interaction (installed once; survives innerHTML swaps) */
  panel.addEventListener('click', onEvt);
  panel.addEventListener('mouseover', onEvt);
  function onEvt(e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act, i = t.dataset.i != null ? +t.dataset.i : null;
    if (act === 'back') { if (e.type === 'click') closePanel(); return; }
    if (act === 'open') { if (e.type !== 'click') return; V.open = V.open === i ? null : i; paint(); return; }
    if (act === 'day') { updateYearNote(i); return; }   // light update, no full repaint
    if (act === 'mi') V.mi = i;
    else if (act === 'pd') V.pd = i;
    else if (act === 'sb') V.sb = i;
    else return;
    paint();
  }

  /* recompute geometry on resize while open */
  let rt;
  window.addEventListener('resize', () => {
    if (!panel.classList.contains('open') || !S) return;
    clearTimeout(rt);
    rt = setTimeout(() => { measureCW(); paint(); }, 120);
  });

  /* swipe: left swipe opens (page slides in from the right), right swipe closes */
  let tx = null, ty = null, txTarget = null;
  document.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; txTarget = e.target;
  }, { passive: true });
  function inHorizontalScroller(el) {
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 5) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      el = el.parentElement;
    }
    return false;
  }
  document.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = Math.abs(e.changedTouches[0].clientY - ty);
    if (Math.abs(dx) > 70 && dy < 60) {
      const fromScroller = !panel.classList.contains('open') && inHorizontalScroller(txTarget);
      if (dx < 0 && !panel.classList.contains('open') && !fromScroller) openPanel();
      if (dx > 0 && panel.classList.contains('open')) closePanel();
    }
    tx = null;
  }, { passive: true });

  /* ---------- responsive content width ----------
     cw is the chart width *inside a card*, matching the handoff's
     cw = pageW − 2·pagePad − (2 card paddings). We derive it from the
     app column's real rendered width so SVG (width:100%, viewBox 0 0 cw H)
     renders 1:1 with no distortion. */
  function measureCW() {
    let box = app.getBoundingClientRect().width;     // border-box, real width
    if (!box || box < 10) box = Math.min((window.innerWidth || 390) - 32, 560); // fallback
    const pad = box >= 480 ? 26 : 20;
    app.style.padding = pad + 'px';
    // subtract: app borders (2) + 2·pad + card borders (2) + 2·card padding (36)
    V.cw = Math.max(180, Math.round(box - 40 - pad * 2));
    V.wide = box >= 480;
  }

  /* ---------- render ---------- */
  function render() {
    if (!S) {
      app.style.padding = '20px';
      app.innerHTML = `<div data-act="back" style="cursor:pointer;color:${T3};font:700 12px ${F};padding:6px">← Back</div>
        <div style="text-align:center;color:${T3};font:500 13px ${F};padding:40px 0">Loading your progress…</div>`;
      load().then(() => { if (panel.classList.contains('open')) render(); });
      return;
    }
    V.mi = clamp(V.mi, 0, Math.max(0, S.months.length - 1));
    measureCW();   // getBoundingClientRect forces layout → reliable width
    paint();
  }

  function paint() {
    const cw = V.cw, wide = V.wide;
    const m = S.meta, C = S.counters;

    /* ---- header ---- */
    const title = m.monthsIn <= 1 ? 'One month in' : (WORDS[m.monthsIn] || m.monthsIn) + ' months in';
    const fmt = iso => { const p = iso.split('-'); return MONALL[+p[1] - 1] + ' ' + (+p[2]); };
    const sub = fmt(m.startISO) + ' – ' + fmt(m.endISO) + ', ' + m.endISO.slice(0, 4) +
      ' · ' + m.habitCount + ' habit' + (m.habitCount === 1 ? '' : 's');
    const header = `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:6px 2px 22px;">
      <div style="display:flex;flex-direction:column;gap:7px;min-width:0;">
        <div style="font:700 10px/1 ${F};letter-spacing:0.18em;color:${T4};">PROGRESS</div>
        <div style="font:800 27px/1 ${F};letter-spacing:-0.03em;color:${T0};">${esc(title)}</div>
        <div style="font:500 12px/1.4 ${F};color:${T3};">${esc(sub)}</div>
      </div>
      <div data-act="back" style="cursor:pointer;padding:7px 12px;border-radius:999px;background:#14141B;border:1px solid rgba(255,255,255,0.06);font:700 10.5px ${F};color:${T2};flex:none;">← Back</div>
    </div>`;

    /* ---- 1 · all-time counters ---- */
    const vsb = C.vsBestMonth == null ? '–' : (C.vsBestMonth >= 0 ? '+' : '') + C.vsBestMonth;
    const tiles = [
      { v: C.perfectDays, l: 'PERFECT DAYS', c: T0 },
      { v: (C.habitWins || 0).toLocaleString(), l: 'HABIT WINS', c: T0 },
      { v: C.comebacks, l: 'COMEBACKS', c: T0 },
      { v: vsb, l: 'VS BEST MONTH', c: GLD }
    ].map(t => `<div style="background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.05);border-radius:14px;padding:15px 14px;display:flex;flex-direction:column;gap:7px;">
      <div style="font:800 23px/1 ${F};letter-spacing:-0.03em;color:${t.c};">${t.v}</div>
      <div style="font:700 9px/1.3 ${F};letter-spacing:0.14em;color:${T5};">${t.l}</div></div>`).join('');
    const counters = `<div style="display:grid;grid-template-columns:${wide ? 'repeat(4,1fr)' : 'repeat(2,1fr)'};gap:10px;">${tiles}</div>`;

    /* ---- 2 · momentum waveform ---- */
    const momentum = renderMomentum(cw);

    /* ---- 3 · habit momentum rows ---- */
    const habitMom = renderHabitMomentum(cw);

    /* ---- 4 · consistency ---- */
    const consistency = renderConsistency();

    /* ---- 5 · power days ---- */
    const power = renderPowerDays(cw);

    /* ---- 6 · where habits break ---- */
    const breaks = renderBreaks(cw);

    /* ---- 7 · your year ---- */
    const year = renderYear(cw, wide);

    /* ---- 8 · leaderboard ---- */
    const board = renderBoard();

    const footer = `<div style="text-align:center;font:500 10.5px/1.6 ${F};color:${T7};padding:18px 0 4px;">${m.daysTracked} days tracked · updated today</div>`;

    app.innerHTML = header +
      `<div class="hs-cards">${counters}${momentum}${habitMom}${consistency}${power}${breaks}${year}${board}</div>` +
      footer;
  }

  /* ===== section builders ===== */
  const sectionHead = (label, meta, metaColor) =>
    `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="font:700 10px/1 ${F};letter-spacing:0.18em;color:${T4};">${label}</div>
      <div style="font:600 9.5px/1 ${F};letter-spacing:0.12em;color:${metaColor || T6};">${meta}</div>
    </div>`;

  function renderMomentum(cw) {
    const MV = S.months.map(x => x.pct);
    const MON = S.months.map(x => x.name), MONF = S.months.map(x => x.full);
    const n = MV.length;
    const head = sectionHead('MOMENTUM', 'MONTHLY COMPLETION');
    if (n < 2) {
      const only = MV[0] || 0;
      return `<div class="hs-card" style="padding:18px 18px 14px;">${head}
        <div style="display:flex;align-items:flex-end;gap:10px;margin:16px 0 0;">
          <div style="font:800 46px/0.9 ${F};letter-spacing:-0.04em;color:${T0};">${only}<span style="font:700 19px ${F};color:#7C7990;">%</span></div>
        </div>
        <div style="font:500 12px/1 ${F};color:${T3};margin:9px 0 2px;">${MONF[0] || ''} · first month tracked · the line starts next month</div>
      </div>`;
    }
    const mh = 152, top = 16, base = 120;
    const dmin = Math.min.apply(null, MV) - 16, dmax = Math.max.apply(null, MV) + 10;
    const yOf = v => top + (1 - (v - dmin) / (dmax - dmin || 1)) * (base - top);
    const step = cw / n, padX = step / 2;
    const pts = MV.map((v, i) => ({ x: padX + i * step, y: yOf(v) }));
    const line = smooth(pts);
    const path = 'M 0 ' + pts[0].y.toFixed(1) + ' L ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1) +
      ' ' + line.slice(1) + ' L ' + cw + ' ' + pts[n - 1].y.toFixed(1);
    const area = path + ' L ' + cw + ' ' + base + ' L 0 ' + base + ' Z';
    const grid = [0.34, 0.67, 1].map(t =>
      `<line x1="0" y1="${(top + t * (base - top)).toFixed(1)}" x2="${cw}" y2="${(top + t * (base - top)).toFixed(1)}" stroke="rgba(255,255,255,0.04)" stroke-width="1"></line>`).join('');
    const mi = V.mi;
    const hits = MV.map((v, i) =>
      `<rect data-act="mi" data-i="${i}" x="${(i * step).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${mh}" fill="transparent" style="cursor:pointer;"></rect>`).join('');
    const labels = MON.map((t, i) =>
      `<div style="flex:1 1 0;text-align:center;font:600 10px ${F};letter-spacing:0.04em;color:${i === mi ? LAV : T6};transition:color .2s ease;">${t}</div>`).join('');
    const hv = MV[mi];
    const dl = mi === 0 ? null : MV[mi] - MV[mi - 1];
    const chip = dl === null ? '' :
      `<div style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;font:700 11.5px ${F};background:${dl >= 0 ? 'rgba(151,196,89,0.12)' : 'rgba(240,149,149,0.11)'};color:${dl >= 0 ? GRN : RED};margin-bottom:7px;">${dl >= 0 ? '↑ ' : '↓ '}${Math.abs(dl)} pts</div>`;
    const daysIn = +m0Day();
    const sub = mi === 0 ? (MONF[0] + ' · first month tracked')
      : MONF[mi] + ' vs ' + MONF[mi - 1] + (mi === n - 1 ? ' · ' + daysIn + ' days in' : '');
    const hx = pts[mi].x.toFixed(1), hy = pts[mi].y.toFixed(1);

    return `<div class="hs-card" style="padding:18px 18px 14px;">${head}
      <div style="display:flex;align-items:flex-end;gap:10px;margin:16px 0 0;">
        <div style="font:800 46px/0.9 ${F};letter-spacing:-0.04em;color:${T0};">${hv}<span style="font:700 19px ${F};color:#7C7990;">%</span></div>
        ${chip}
      </div>
      <div style="font:500 12px/1 ${F};color:${T3};margin:9px 0 10px;">${esc(sub)}</div>
      <svg width="100%" height="${mh}" viewBox="0 0 ${cw} ${mh}" preserveAspectRatio="none" style="display:block;">
        <defs>
          <linearGradient id="hsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${PUR}" stop-opacity="0.40"></stop>
            <stop offset="0.5" stop-color="${PUR}" stop-opacity="0.13"></stop>
            <stop offset="1" stop-color="${PUR}" stop-opacity="0"></stop></linearGradient>
          <linearGradient id="hsLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${PUR}"></stop><stop offset="1" stop-color="${LAV}"></stop></linearGradient>
          <filter id="hsBlur" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="6"></feGaussianBlur></filter>
        </defs>
        ${grid}
        <path d="${area}" fill="url(#hsFill)"></path>
        <path d="${path}" fill="none" stroke="url(#hsLine)" stroke-width="7" opacity="0.22" filter="url(#hsBlur)" stroke-linecap="round"></path>
        <path d="${path}" fill="none" stroke="url(#hsLine)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>
        <line x1="${hx}" y1="${hy}" x2="${hx}" y2="${base}" stroke="rgba(175,169,236,0.22)" stroke-width="1" stroke-dasharray="2 3"></line>
        <circle cx="${hx}" cy="${hy}" r="12" fill="rgba(175,169,236,0.14)" style="animation:hsHalo 2.8s ease-in-out infinite;"></circle>
        <circle cx="${hx}" cy="${hy}" r="5.4" fill="#0D0D12" stroke="${LAV}" stroke-width="2.4"></circle>
        ${hits}
      </svg>
      <div style="display:flex;margin-top:8px;">${labels}</div>
    </div>`;
  }
  // elapsed days in the current (latest) month = day-of-month of endISO
  function m0Day() { return +S.meta.endISO.slice(8, 10); }

  function renderHabitMomentum(cw) {
    const H = S.habitStats, sw = cw, sh = 46, sTop = 6, sBase = 40;
    const rows = H.map((h, i) => {
      const dotC = h.pct >= 75 ? 'rgba(151,196,89,0.85)' : (h.pct >= 55 ? 'rgba(250,199,117,0.8)' : 'rgba(240,149,149,0.8)');
      const dCol = h.delta == null ? T4 : (h.delta > 0 ? GRN : (h.delta < 0 ? RED : T4));
      const dTxt = h.delta == null ? '' : (h.delta >= 0 ? '↑ ' : '↓ ') + Math.abs(h.delta);
      let body = '';
      if (V.open === i) {
        let spark = '';
        if (h.series.length >= 2) {
          const lo = Math.min.apply(null, h.series) - 8, hi = Math.max.apply(null, h.series) + 6;
          const sp = h.series.map((val, j) => ({ x: (j / (h.series.length - 1)) * sw, y: sTop + (1 - (val - lo) / (hi - lo || 1)) * (sBase - sTop) }));
          const p = smooth(sp);
          spark = `<svg width="100%" height="${sh}" viewBox="0 0 ${sw} ${sh}" preserveAspectRatio="none" style="display:block;">
            <defs><linearGradient id="hsSpark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PUR}" stop-opacity="0.3"></stop><stop offset="1" stop-color="${PUR}" stop-opacity="0"></stop></linearGradient></defs>
            <path d="${p} L ${sw} ${sBase} L 0 ${sBase} Z" fill="url(#hsSpark)"></path>
            <path d="${p}" fill="none" stroke="#8B84E2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="${sp[sp.length - 1].x.toFixed(1)}" cy="${sp[sp.length - 1].y.toFixed(1)}" r="3.4" fill="${LAV}"></circle>
          </svg>`;
        }
        body = `<div style="padding:2px 0 18px;">${spark}
          <div style="display:flex;gap:18px;margin-top:11px;">
            <div style="font:500 11px/1.5 ${F};color:${T3};">Best streak <span style="color:${T1};font-weight:700;">${h.best} days</span></div>
            <div style="font:500 11px/1.5 ${F};color:${T3};">All-time <span style="color:${T1};font-weight:700;">${h.all}%</span></div>
          </div></div>`;
      }
      return `<div style="border-bottom:1px solid ${DIV};">
        <div data-act="open" data-i="${i}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 0;cursor:pointer;">
          <div style="display:flex;align-items:center;gap:9px;min-width:0;">
            <div style="width:5px;height:5px;border-radius:999px;flex:none;background:${dotC};"></div>
            <div style="font:600 13.5px/1.4 ${F};color:${T1};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(h.name)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:11px;flex:none;">
            <div style="font:700 13.5px/1 ${F};color:${T2};font-variant-numeric:tabular-nums;">${h.pct}%</div>
            <div style="font:700 11.5px/1 ${F};color:${dCol};min-width:34px;text-align:right;">${dTxt}</div>
          </div>
        </div>${body}
      </div>`;
    }).join('');
    return `<div class="hs-card" style="padding:18px 18px 8px;">${sectionHead('HABIT MOMENTUM', 'VS ' + prevMonthName().toUpperCase())}
      <div style="display:flex;flex-direction:column;margin-top:6px;">${rows}</div></div>`;
  }
  function prevMonthName() {
    const n = S.months.length;
    return n >= 2 ? S.months[n - 2].full : (S.months[0] ? S.months[0].full : '');
  }

  function renderConsistency() {
    const A0 = 132, SW = 276, r = 56, cx = 73, cy = 62, score = S.consistency;
    const track = arcPath(cx, cy, r, A0, A0 + SW);
    const prog = arcPath(cx, cy, r, A0, A0 + SW * score / 100);
    const tip = pol(cx, cy, r, A0 + SW * score / 100);
    const bar = (label, val, color) => `<div style="display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;"><div style="font:600 11.5px ${F};color:${T3};">${label}</div><div style="font:800 15px ${F};color:${T1};">${val}%</div></div>
      <div style="height:5px;border-radius:999px;background:rgba(255,255,255,0.055);overflow:hidden;"><div style="width:${val}%;height:100%;border-radius:999px;background:${color};"></div></div></div>`;
    return `<div class="hs-card">
      <div style="font:700 10px/1 ${F};letter-spacing:0.18em;color:${T4};">CONSISTENCY</div>
      <div style="display:flex;align-items:center;gap:18px;margin-top:12px;">
        <div style="position:relative;width:146px;height:132px;flex:none;">
          <svg width="146" height="132" viewBox="0 0 146 132" style="display:block;overflow:visible;">
            <defs><linearGradient id="hsArc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${PUR}"></stop><stop offset="1" stop-color="${LAV}"></stop></linearGradient></defs>
            <path d="${track}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10" stroke-linecap="round"></path>
            <path d="${prog}" fill="none" stroke="url(#hsArc)" stroke-width="10" stroke-linecap="round"></path>
            <circle cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="9" fill="rgba(175,169,236,0.16)"></circle>
            <circle cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="3.4" fill="#DAD6FA"></circle>
          </svg>
          <div style="position:absolute;left:0;top:0;width:146px;height:124px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;pointer-events:none;">
            <div style="font:800 34px/1 ${F};letter-spacing:-0.04em;color:${T0};">${score}</div>
            <div style="font:700 9px/1 ${F};letter-spacing:0.18em;color:${T4};">ON PLAN</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;flex:1 1 0;min-width:0;">
          ${bar('Weekdays', S.weekdayAvg, GRN)}
          ${bar('Weekends', S.weekendAvg, RED)}
          <div style="font:600 11px/1.4 ${F};color:${RED};white-space:nowrap;">Weekend dip · ${S.dip} pts</div>
        </div>
      </div></div>`;
  }

  function renderPowerDays(cw) {
    const pd = S.weekday, best = S.bestDay, score = S.consistency;
    const sel = V.pd == null ? best : V.pd;
    const tX = 34, tW = cw - 82, rowH = 32, pdH = 7 * rowH;
    const avgLineX = (tX + tW * score / 100).toFixed(1);
    const lanes = pd.map((val, i) => ({ i, val })).sort((a, b) => b.val - a.val);
    let svgRows = '', labelRows = '', valueRows = '';
    lanes.forEach((o, rank) => {
      const y = rank * rowH + 4, isB = o.i === best, isS = o.i === sel;
      const fill = isB ? GLD : (isS ? LAV : 'rgba(127,119,221,0.40)');
      svgRows += `<g data-act="pd" data-i="${o.i}" style="cursor:pointer;">
        <rect x="0" y="${y - 10}" width="${cw}" height="${rowH}" fill="transparent"></rect>
        <rect x="${tX}" y="${y}" width="${tW.toFixed(1)}" height="12" rx="6" fill="rgba(255,255,255,0.045)"></rect>
        <rect x="${tX}" y="${y}" width="${(tW * o.val / 100).toFixed(1)}" height="12" rx="6" fill="${fill}" style="transition:fill .2s ease;"></rect></g>`;
      labelRows += `<div style="position:absolute;left:0;top:${y + 6}px;transform:translateY(-50%);font:700 11px/1 ${F};letter-spacing:0.06em;color:${isB || isS ? T2 : T5};pointer-events:none;">${WD[o.i].toUpperCase()}</div>`;
      valueRows += `<div style="position:absolute;right:0;top:${y + 6}px;transform:translateY(-50%);font:800 12px/1 ${F};color:${isB ? GLD : (isS ? LAV : T3)};pointer-events:none;">${o.val}%</div>`;
    });
    const pdLabel = (V.pd == null ? 'Best · ' : '') + WD[sel] + ' ' + pd[sel] + '%';
    const pdBg = sel === best ? 'rgba(250,199,117,0.12)' : 'rgba(175,169,236,0.12)';
    const pdCol = sel === best ? GLD : LAV;
    return `<div class="hs-card" style="padding:18px 18px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="font:700 10px/1 ${F};letter-spacing:0.18em;color:${T4};">POWER DAYS</div>
        <div style="padding:5px 10px;border-radius:999px;background:${pdBg};font:700 11px ${F};color:${pdCol};">${pdLabel}</div>
      </div>
      <div style="position:relative;height:13px;margin-top:16px;">
        <div style="position:absolute;left:${avgLineX}px;top:0;transform:translateX(-50%);font:700 8.5px/1 ${F};letter-spacing:0.14em;color:${T6};white-space:nowrap;">AVG ${score}</div>
      </div>
      <div style="position:relative;">
        <svg width="100%" height="${pdH}" viewBox="0 0 ${cw} ${pdH}" preserveAspectRatio="none" style="display:block;">
          <line x1="${avgLineX}" y1="0" x2="${avgLineX}" y2="${pdH}" stroke="rgba(255,255,255,0.13)" stroke-width="1" stroke-dasharray="2 4"></line>
          ${svgRows}
        </svg>
        ${labelRows}${valueRows}
      </div></div>`;
  }

  function renderBreaks(cw) {
    const H = S.habitStats, score = S.consistency;
    const px5 = 22, sx5 = (cw - 44) / 6, y5 = v => 150 - ((v - 20) / 80) * 130;
    const means = H.map(h => mean(h.row));
    const weak = means.indexOf(Math.min.apply(null, means));
    const sb = V.sb, focus = sb == null ? weak : sb;
    const avgY = y5(score).toFixed(1);
    const bandX = (px5 + 4 * sx5 - sx5 * 0.5).toFixed(1), bandW = (sx5 * 2).toFixed(1);
    const lines = H.map((h, i) => {
      const pts = ORD.map((w, j) => ({ x: px5 + j * sx5, y: y5(h.row[w]) }));
      const on = i === focus;
      const stroke = on ? (sb == null ? RED : LAV) : (sb == null ? 'rgba(127,119,221,0.26)' : 'rgba(127,119,221,0.13)');
      return `<path d="${smooth(pts)}" fill="none" stroke="${stroke}" stroke-width="${on ? 2.4 : 1.4}" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .2s ease;"></path>`;
    }).join('');
    const dots = ORD.map((w, j) =>
      `<circle cx="${(px5 + j * sx5).toFixed(1)}" cy="${y5(H[focus].row[w]).toFixed(1)}" r="3.2" fill="${sb == null ? RED : LAV}"></circle>`).join('');
    const wdCells = ORD.map(w =>
      `<div style="flex:1 1 0;text-align:center;font:700 10px/1 ${F};letter-spacing:0.06em;color:${w >= 4 && w <= 5 ? T3 : T6};">${WDL[w]}</div>`).join('');
    const chips = H.map((h, i) => {
      const on = i === focus;
      return `<div data-act="sb" data-i="${i}" style="cursor:pointer;padding:6px 10px;border-radius:999px;font:600 10.5px/1 ${F};background:${on ? 'rgba(175,169,236,0.14)' : 'transparent'};color:${on ? LAV : T4};border:1px solid ${on ? 'rgba(175,169,236,0.35)' : 'rgba(255,255,255,0.07)'};transition:all .18s ease;">${esc(h.name)}</div>`;
    }).join('');
    const note = sb == null ? 'Fri–Sat is the cliff' : esc(H[sb].name) + ' · low ' + Math.min.apply(null, H[sb].row) + '%';
    return `<div class="hs-card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="font:700 10px/1 ${F};letter-spacing:0.18em;color:${T4};">WHERE HABITS BREAK</div>
        <div style="font:600 11px/1 ${F};color:${sb == null ? T3 : LAV};">${note}</div>
      </div>
      <div style="position:relative;margin-top:14px;">
        <svg width="100%" height="164" viewBox="0 0 ${cw} 164" preserveAspectRatio="none" style="display:block;">
          <rect x="${bandX}" y="0" width="${bandW}" height="150" rx="10" fill="rgba(240,149,149,0.055)"></rect>
          <line x1="0" y1="${avgY}" x2="${cw}" y2="${avgY}" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="2 4"></line>
          ${lines}${dots}
        </svg>
        <div style="position:absolute;left:0;top:${avgY}px;transform:translateY(-50%);font:700 8px/1 ${F};letter-spacing:0.14em;color:${T6};background:${CARD};padding-right:5px;">AVG</div>
      </div>
      <div style="display:flex;">${wdCells}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:16px;">${chips}</div></div>`;
  }

  function renderYear(cw, wide) {
    const days = S.year, gap = wide ? 1.8 : 1.4, cell = (cw + gap) / 53 - gap;
    const year = +S.meta.endISO.slice(0, 4);
    const lead = (new Date(year, 0, 1).getDay() + 6) % 7;
    const lv = ['#191921', 'rgba(151,196,89,0.20)', 'rgba(151,196,89,0.38)', 'rgba(151,196,89,0.62)', GRN];
    const yrH = (7 * (cell + gap) - gap).toFixed(1);
    const cells = days.map((dy, i) => {
      const k = lead + i, col = Math.floor(k / 7), row = dy.wd;
      const lvl = dy.c === 0 ? 0 : (dy.c <= 2 ? 1 : (dy.c <= 4 ? 2 : (dy.c === 5 ? 3 : 4)));
      const fill = dy.future ? '#101016' : lv[lvl];
      const act = dy.future ? '' : ` data-act="day" data-i="${i}"`;
      return `<rect${act} x="${(col * (cell + gap)).toFixed(2)}" y="${(row * (cell + gap)).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${(cell * 0.28).toFixed(2)}" fill="${fill}" style="cursor:${dy.future ? 'default' : 'pointer'};"></rect>`;
    }).join('');
    const months = YRM.map(x => `<div style="flex:1 1 0;font:700 9px ${F};letter-spacing:0.1em;color:${T6};">${x}</div>`).join('');
    return `<div class="hs-card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="font:700 10px/1 ${F};letter-spacing:0.18em;color:${T4};">YOUR YEAR</div>
        <div data-yrnote style="font:600 11px/1 ${F};color:${T3};">${S.meta.daysLogged} days logged</div>
      </div>
      <div style="display:flex;margin:16px 0 6px;">${months}</div>
      <svg width="100%" height="${yrH}" viewBox="0 0 ${cw} ${yrH}" preserveAspectRatio="none" style="display:block;">${cells}</svg></div>`;
  }
  function updateYearNote(i) {
    const dy = S.year[i]; if (!dy || dy.future) return;
    V.day = i;
    const el = panel.querySelector('[data-yrnote]'); if (!el) return;
    el.textContent = MONALL[dy.m] + ' ' + dy.d + ' · ' + dy.c + ' of ' + S.meta.habitCount + ' habits';
    el.style.color = dy.c >= 5 ? GRN : (dy.c >= 3 ? T2 : RED);
  }

  function renderBoard() {
    const badge = [
      { bg: GLD, fg: '#17171F', bd: GLD },
      { bg: 'rgba(175,169,236,0.9)', fg: '#17171F', bd: 'rgba(175,169,236,0.9)' },
      { bg: 'rgba(175,169,236,0.14)', fg: LAV, bd: 'rgba(175,169,236,0.4)' }
    ];
    const board = S.habitStats.map(h => ({ n: h.name, b: h.best, all: h.all }))
      .sort((a, b) => b.all - a.all)
      .map((h, i) => {
        const bd = badge[i];
        return `<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid ${DIV};">
          <div style="width:23px;height:23px;border-radius:999px;flex:none;display:flex;align-items:center;justify-content:center;font:800 11px ${F};background:${bd ? bd.bg : 'transparent'};color:${bd ? bd.fg : T5};border:1px solid ${bd ? bd.bd : 'rgba(255,255,255,0.08)'};">${i + 1}</div>
          <div style="font:600 13.5px/1.4 ${F};color:${T1};flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(h.n)}</div>
          <div style="font:500 11px/1 ${F};color:${T4};flex:none;">${h.b}d best</div>
          <div style="font:800 14px/1 ${F};color:${i === 0 ? GLD : T2};flex:none;font-variant-numeric:tabular-nums;">${h.all}%</div>
        </div>`;
      }).join('');
    return `<div class="hs-card" style="padding:18px 18px 10px;">${sectionHead('LEADERBOARD', 'ALL TIME')}
      <div style="display:flex;flex-direction:column;margin-top:4px;">${board}</div></div>`;
  }

  async function load() {
    try {
      const r = await fetch(API + '/get-stats');
      S = await r.json();
      V.mi = Math.max(0, (S.months ? S.months.length : 1) - 1);
      return S;
    } catch (e) { console.error('stats load failed', e); return null; }
  }

  /* ---------- onboarding ---------- */
  const ob = document.createElement('div');
  ob.id = 'obx';
  document.body.appendChild(ob);
  let step = 0;
  let obHabits = { bad: [], good: [] };
  let obOrig = { bad: [], good: [] };
  let focus = { good: null, bad: null };

  function obRender() {
    const dots = ['●○○○', '○●○○', '○○●○', '○○○●'][step];
    if (step === 0) ob.innerHTML = `<div class="obx-wrap">
      <div class="obx-dots">${dots}</div>
      <div class="obx-big">⚡</div>
      <div class="obx-t">One habit at a time.</div>
      <div class="obx-s">Three minutes from here to your first checkmark.</div>
      <div class="obx-info" style="border:1px solid #27500A"><b style="color:#97C459">▲ Build — good habits</b>
        <div>Tick when you did it. Exercise, read, sleep on time.</div></div>
      <div class="obx-info" style="border:1px solid #501313"><b style="color:#F09595">▼ Avoid — bad habits</b>
        <div>Tick when you resisted. A tick = a win, both ways.</div></div>
      <button class="obx-btn" id="obx-next">Let's set up →</button></div>`;
    if (step === 1) ob.innerHTML = `<div class="obx-wrap">
      <div class="obx-dots">${dots}</div>
      <div class="obx-t" style="text-align:left">Your habits</div>
      <div class="obx-s" style="text-align:left">We filled in six classics — make them yours, or keep them.<br><span style="font-size:10px">min 3 + 3 · max 7 + 7 · tap a name to edit it</span></div>
      <div class="obx-lbl" style="color:#F09595">▼ AVOID</div>
      ${obHabits.bad.map((h, i) => `<div class="obx-item"><input data-t="bad" data-i="${i}" value="${h}" placeholder="Enter habit here"></div>`).join('')}
      ${obHabits.bad.length < 7 ? '<div class="obx-add" data-add="bad">+ add habit</div>' : '<div class="obx-add" style="cursor:default;background:var(--bg-card-inner);border:1px solid var(--border-default);color:var(--text-secondary)">Maxed out!</div>'}
      <div class="obx-lbl" style="color:#97C459">▲ BUILD</div>
      ${obHabits.good.map((h, i) => `<div class="obx-item"><input data-t="good" data-i="${i}" value="${h}" placeholder="Enter habit here"></div>`).join('')}
      ${obHabits.good.length < 7 ? '<div class="obx-add" data-add="good">+ add habit</div>' : '<div class="obx-add" style="cursor:default;background:var(--bg-card-inner);border:1px solid var(--border-default);color:var(--text-secondary)">Maxed out!</div>'}
      <button class="obx-btn" id="obx-next">Keep these ✓</button></div>`;
    if (step === 2) ob.innerHTML = `<div class="obx-wrap">
      <div class="obx-dots">${dots}</div>
      <div class="obx-t" style="text-align:left">Pick your focus</div>
      <div class="obx-s" style="text-align:left">One to build, one to eliminate — 30 days of extra attention.</div>
      <div class="obx-lbl" style="color:#97C459">▲ BUILDING</div>
      ${obHabits.good.filter(Boolean).map(h => `<div class="obx-item ${focus.good === h ? 'sel' : ''}" data-fg="${h}"><span>${focus.good === h ? '●' : '○'} ${h}</span></div>`).join('')}
      <div class="obx-lbl" style="color:#F09595">▼ ELIMINATING</div>
      ${obHabits.bad.filter(Boolean).map(h => `<div class="obx-item ${focus.bad === h ? 'selbad' : ''}" data-fb="${h}"><span>${focus.bad === h ? '●' : '○'} ${h}</span></div>`).join('')}
      <button class="obx-btn" id="obx-next" ${focus.good && focus.bad ? '' : 'disabled'}>Continue →</button></div>`;
    if (step === 3) ob.innerHTML = `<div class="obx-wrap">
      <div class="obx-dots">${dots}</div>
      <div class="obx-big">🎉</div>
      <div class="obx-t">You're ready.</div>
      <div class="obx-s">Six habits. Two in focus.<br>Today's card is waiting.</div>
      <button class="obx-btn" id="obx-next">Tick your first habit →</button>
      <div class="obx-foot">Writes your habits to the sheet · never shows again</div></div>`;

    ob.querySelectorAll('input[data-t]').forEach(inp => {
      inp.onchange = () => { obHabits[inp.dataset.t][+inp.dataset.i] = inp.value.trim(); };
    });
    ob.querySelectorAll('[data-add]').forEach(el => el.onclick = () => {
      obHabits[el.dataset.add].push('');
      obRender();
      const inputs = ob.querySelectorAll(`input[data-t="${el.dataset.add}"]`);
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    ob.querySelectorAll('[data-fg]').forEach(el => el.onclick = () => { focus.good = el.dataset.fg; obRender(); });
    ob.querySelectorAll('[data-fb]').forEach(el => el.onclick = () => { focus.bad = el.dataset.fb; obRender(); });
    const next = $('#obx-next', ob);
    if (next) next.onclick = obNext;
  }

  async function obNext() {
    if (step === 1) {
      obHabits.bad = obHabits.bad.map(s => s.trim());
      obHabits.good = obHabits.good.map(s => s.trim());
      const nBad = obHabits.bad.filter(Boolean).length;
      const nGood = obHabits.good.filter(Boolean).length;
      if (nBad < 3 || nGood < 3) {
        alert('You need at least 3 good and 3 bad habits.'); return;
      }
      focus.good = obHabits.good.filter(Boolean)[0];
      focus.bad = obHabits.bad.filter(Boolean)[0];
    }
    if (step === 3) { await obFinish(); return; }
    step++; obRender();
  }

  async function obFinish() {
    const btn = $('#obx-next', ob);
    btn.disabled = true; btn.textContent = 'Setting up…';
    try {
      // sync habit list: rename / add / remove via existing endpoint
      for (const type of ['bad', 'good']) {
        const n = Math.max(obHabits[type].length, obOrig[type].length);
        for (let i = 0; i < n; i++) {
          const oldName = (obOrig[type][i] || '').trim();
          const newName = (obHabits[type][i] || '').trim();
          const call = body => fetch(API + '/update-config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (oldName && newName && oldName !== newName) {
            await call({ action: 'replace', type, name: oldName, newName });
          } else if (!oldName && newName) {
            await call({ action: 'add', type, newName });
          } else if (oldName && !newName) {
            await call({ action: 'remove', type, name: oldName });
          }
        }
      }
      await fetch(API + '/update-focus', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'good', habitName: focus.good }) });
      await fetch(API + '/update-focus', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bad', habitName: focus.bad }) });
      await fetch(API + '/set-onboarded', { method: 'POST' });
    } catch (e) { console.error('onboarding write failed', e); }
    ob.classList.remove('show');
    location.reload();
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    const s = await load();
    if (s && s.needsOnboarding) {
      obHabits.bad  = s.habits.filter(h => h.type === 'bad').map(h => h.name);
      obHabits.good = s.habits.filter(h => h.type === 'good').map(h => h.name);
      obOrig.bad = obHabits.bad.slice(); obOrig.good = obHabits.good.slice();
      step = 0; obRender(); ob.classList.add('show');
    }
  });
})();
