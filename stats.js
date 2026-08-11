/* ============================================================
   HABIT TRACKER — STATS PAGE (right-swipe) + ONBOARDING
   Self-contained module. Loaded via <script src="stats.js" defer>
   right before </body>. Uses the app's CSS variables so it
   follows light/dark theme automatically.
   ============================================================ */
(function () {
  'use strict';
  const API = '/api';
  const $ = (sel, el) => (el || document).querySelector(sel);

  /* ---------- styles ---------- */
  const css = `
  #stx-panel{position:fixed;inset:0;background:var(--bg-page);z-index:80;
    transform:translateX(100%);transition:transform .28s ease;overflow-y:auto;
    padding:16px 14px 40px 14px;-webkit-overflow-scrolling:touch}
  #stx-panel.open{transform:translateX(0)}
  .stx-wrap{max-width:560px;margin:0 auto}
  .stx-svg{width:100%;height:110px;display:block}
  .stx-ring{display:block;margin:0 auto;width:58px;height:58px}
  .stx-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .stx-back{color:var(--text-secondary);font-size:12px;cursor:pointer;padding:6px}
  .stx-title{font-weight:700;font-size:15px}
  .stx-dots{text-align:center;font-size:9px;color:var(--text-secondary);margin-bottom:10px}
  .stx-card{background:var(--bg-card);border:1px solid var(--border-default);
    border-radius:14px;padding:12px;margin-bottom:10px}
  .stx-h{font-size:11px;font-weight:600;color:#AFA9EC;margin-bottom:8px}
  .stx-sub{font-size:9px;color:var(--text-secondary)}
  .stx-note{font-size:10px;color:#97C459;margin-top:6px}
  .stx-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:3px 0}
  .stx-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
  .stx-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
  .stx-tile{background:var(--bg-card-inner);border-radius:10px;padding:8px;text-align:center}
  .stx-tile b{font-size:15px;display:block}
  .stx-tile span{font-size:8px;color:var(--text-secondary)}
  .stx-bars{display:flex;gap:4px;align-items:flex-end;height:44px}
  .stx-bars>div{flex:1;text-align:center}
  .stx-bars i{display:block;border-radius:3px 3px 0 0;background:#3C3489}
  .stx-bars em{font-style:normal;font-size:8px;color:var(--text-secondary)}
  .stx-mx{width:100%;border-collapse:collapse;font-size:9px;text-align:center}
  .stx-mx td{padding:3px 1px;border-radius:2px}
  .stx-mx td:first-child{text-align:left;font-size:10px}
  .stx-year{display:grid;grid-template-columns:repeat(31,1fr);gap:2px}
  .stx-year i{min-height:6px}
  .stx-year i{aspect-ratio:1;border-radius:1px;background:var(--bg-card-inner)}
  .stx-cta{background:#0F1F14;border:1px solid #27500A;border-radius:10px;padding:8px;
    text-align:center;color:#97C459;font-size:10px;margin-top:4px}
  #stx-fab{position:fixed;right:14px;bottom:14px;z-index:70;background:#7F77DD;color:#fff;
    border:none;border-radius:50%;width:44px;height:44px;font-size:18px;cursor:pointer;
    box-shadow:0 4px 14px rgba(0,0,0,.4)}
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
  .obx-foot{text-align:center;color:var(--text-secondary);font-size:9px;margin-top:10px}`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- state ---------- */
  let S = null; // stats payload

  /* ---------- stats panel ---------- */
  const panel = document.createElement('div');
  panel.id = 'stx-panel';
  document.body.appendChild(panel);

  const fab = document.createElement('button');
  fab.id = 'stx-fab';
  fab.textContent = '📊';
  fab.title = 'Progress';
  fab.onclick = openPanel;
  document.body.appendChild(fab);

  function openPanel() {
    render();
    panel.classList.add('open');
  }
  function closePanel() { panel.classList.remove('open'); }

  /* swipe: left swipe opens (page slides in from the right), right swipe closes */
  let tx = null, ty = null;
  document.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = Math.abs(e.changedTouches[0].clientY - ty);
    if (Math.abs(dx) > 70 && dy < 60) {
      if (dx < 0 && !panel.classList.contains('open')) openPanel();
      if (dx > 0 && panel.classList.contains('open')) closePanel();
    }
    tx = null;
  }, { passive: true });

  const pc = v => v === null || v === undefined ? '–' : v + '%';
  const heatColor = p => p === null ? 'var(--bg-card-inner)'
    : p >= 80 ? '#639922' : p >= 60 ? '#3B6D11' : p >= 40 ? '#3a3a22'
    : p >= 20 ? '#7a2a1a' : '#A32D2D';

  function render() {
    if (!S) { panel.innerHTML = '<div class="stx-head"><span class="stx-back">← back</span></div><div class="stx-sub" style="padding:20px;text-align:center">Loading stats…</div>'; bindBack(); load().then(render); return; }

    const mVals = S.months.filter(m => m.good !== null && m.good > 0);
    const w = 260, h = 64;
    const pts = mVals.map((m, i) => {
      const x = 10 + (mVals.length > 1 ? i * (w - 20) / (mVals.length - 1) : 0);
      const y = h - 8 - (m.good * (h - 20));
      return [x, y];
    });
    const poly = pts.map(p => p.join(',')).join(' ');
    const area = poly ? poly + ` ${pts[pts.length-1][0]},${h} ${pts[0][0]},${h}` : '';
    const lastDelta = mVals.length > 1
      ? Math.round((mVals[mVals.length-1].good - mVals[mVals.length-2].good) * 100) : null;

    const mom = S.momentum.map(m => {
      let tag, col;
      if (m.delta === null) { tag = '— new'; col = 'var(--text-secondary)'; }
      else if (m.delta > 2) { tag = '▲ +' + m.delta + '%'; col = '#97C459'; }
      else if (m.delta < -2) { tag = '▼ ' + m.delta + '%'; col = '#FAC775'; }
      else { tag = '— steady'; col = 'var(--text-secondary)'; }
      return `<div class="stx-row"><span>${m.name}</span><span style="color:${col}">${tag}</span></div>`;
    }).join('');

    const wdNames = ['M','T','W','T','F','S','S'];
    const maxWd = Math.max(...S.weekday.map(v => v || 0), 1);
    const wdBars = S.weekday.map((v, i) => {
      const hh = v === null ? 4 : Math.max(4, Math.round(v / maxWd * 40));
      const best = v !== null && v === maxWd;
      return `<div><i style="height:${hh}px;${best ? 'background:#639922' : ''}"></i><em ${best ? 'style="color:#97C459"' : ''}>${wdNames[i]}</em></div>`;
    }).join('');
    const bestD = S.weekday.indexOf(Math.max(...S.weekday.map(v => v || -1)));
    const worstD = S.weekday.indexOf(Math.min(...S.weekday.map(v => v === null ? 999 : v)));
    const dayFull = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    const mxRows = S.matrix.map(m =>
      `<tr><td style="color:${m.type==='bad'?'#F09595':'#97C459'}">${m.name}</td>` +
      m.days.map(d => `<td style="background:${heatColor(d)};color:#ddd">${d===null?'–':d}</td>`).join('') + '</tr>'
    ).join('');

    const yearColor = p => p >= 80 ? '#639922' : p >= 55 ? '#3B6D11' : p >= 30 ? '#2B4A12' : p > 0 ? '#1F2E14' : 'var(--bg-card-inner)';
    const yearCells = S.daily.slice(-186).map(d =>
      `<i style="background:${yearColor(Math.round(d.p * 100))}" title="${d.t}"></i>`).join('');

    const lb = S.leaderboard.map((x, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '·';
      const last = i === S.leaderboard.length - 1 && S.leaderboard.length > 3;
      return `<div class="stx-row"><span>${medal} ${x.name}</span><span style="color:${last ? '#FAC775' : x.pct >= 60 ? '#97C459' : 'var(--text-secondary)'}">${x.pct}%${last ? ' · your next win' : ''}</span></div>`;
    }).join('');

    panel.innerHTML = `
    <div class="stx-wrap">
    <div class="stx-head">
      <span class="stx-back">← back</span>
      <span class="stx-title">📊 Progress</span>
      <span class="stx-sub">${new Date().getFullYear()}</span>
    </div>
    <div class="stx-dots">○ ●</div>

    <div class="stx-card">
      <div style="display:flex;justify-content:space-between">
        <div class="stx-h">Momentum — month by month</div>
        ${lastDelta !== null ? `<div style="font-size:9px;color:${lastDelta >= 0 ? '#97C459' : '#FAC775'}">${lastDelta >= 0 ? '↗ +' : '↘ '}${lastDelta}%</div>` : ''}
      </div>
      ${pts.length > 1 ? `<svg viewBox="0 0 ${w} ${h}" class="stx-svg" preserveAspectRatio="none">
        <defs><linearGradient id="stxg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7F77DD" stop-opacity="0.45"/>
          <stop offset="1" stop-color="#7F77DD" stop-opacity="0"/></linearGradient></defs>
        <polygon points="${area}" fill="url(#stxg)"/>
        <polyline points="${poly}" fill="none" stroke="#AFA9EC" stroke-width="2.5"/>
        <circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="3.5" fill="#97C459"/>
      </svg>
      <div style="display:flex;justify-content:space-between" class="stx-sub">
        <span>${mVals[0] ? mVals[0].name : ''}</span><span style="color:#97C459">${mVals.length ? mVals[mVals.length-1].name : ''}</span>
      </div>` : mVals.length === 1 ? `<div style="text-align:center;padding:8px 0"><b style="font-size:26px;color:#97C459">${Math.round(mVals[0].good*100)}%</b><div class="stx-sub">${mVals[0].name} — your first month on the board.<br>The line starts next month.</div></div>` : '<div class="stx-sub">Your first month is being written right now.</div>'}
    </div>

    <div class="stx-card"><div class="stx-h">Habit momentum — vs last month</div>${mom}</div>

    <div class="stx-grid2">
      <div class="stx-card" style="margin:0;text-align:center">
        <svg viewBox="0 0 60 60" class="stx-ring">
          <circle cx="30" cy="30" r="24" fill="none" stroke="var(--border-default)" stroke-width="7"/>
          <circle cx="30" cy="30" r="24" fill="none" stroke="#97C459" stroke-width="7"
            stroke-dasharray="${(S.consistency / 100 * 151).toFixed(0)} 151" stroke-linecap="round" transform="rotate(-90 30 30)"/>
          <text x="30" y="35" text-anchor="middle" fill="#97C459" font-size="14" font-weight="700">${S.consistency}%</text>
        </svg>
        <div class="stx-sub">Consistency<br>days over 66%</div>
      </div>
      <div class="stx-card" style="margin:0;text-align:center;display:flex;flex-direction:column;justify-content:center">
        <b style="font-size:20px;color:${(S.weekendGap || 0) < 0 ? '#F09595' : '#97C459'}">${S.weekendGap === null ? '–' : (S.weekendGap > 0 ? '+' : '') + S.weekendGap + '%'}</b>
        <div class="stx-sub">Weekend ${(S.weekendGap || 0) < 0 ? 'dip' : 'lift'}<br>vs weekdays</div>
      </div>
    </div>

    <div class="stx-card">
      <div class="stx-h">Power days</div>
      <div class="stx-bars">${wdBars}</div>
      ${bestD >= 0 ? `<div class="stx-note">Book your hardest habits on ${dayFull[bestD]}s.</div>` : ''}
    </div>

    <div class="stx-card">
      <div class="stx-h">Where habits break — this month</div>
      <table class="stx-mx"><tr><td></td>${wdNames.map(d => `<td class="stx-sub">${d}</td>`).join('')}</tr>${mxRows}</table>
      ${worstD >= 0 ? `<div class="stx-note" style="color:#FAC775">Watch out for ${dayFull[worstD]}s — plan around them.</div>` : ''}
    </div>

    <div class="stx-card">
      <div class="stx-h">Your year</div>
      <div class="stx-year">${yearCells}</div>
      <div class="stx-sub" style="margin-top:4px">one square per day — the greener, the stronger</div>
    </div>

    <div class="stx-card"><div class="stx-h">Habit leaderboard — this month</div>${lb}</div>

    <div class="stx-sub" style="text-align:center;margin:6px 0">— all time —</div>
    <div class="stx-grid4">
      <div class="stx-tile"><b style="color:#97C459">${S.perfectDays}</b><span>perfect days</span></div>
      <div class="stx-tile"><b style="color:#FAC775">${S.checksYTD}</b><span>wins YTD</span></div>
      <div class="stx-tile"><b style="color:#97C459">${S.comebacks}</b><span>comebacks</span></div>
      <div class="stx-tile"><b style="color:#AFA9EC">${pc(S.vsBest)}</b><span>of best month</span></div>
    </div>
    <div class="stx-grid4" style="grid-template-columns:repeat(3,1fr)">
      <div class="stx-tile"><b style="color:#97C459">${pc(S.bestDayEver)}</b><span>best day ever</span></div>
      <div class="stx-tile"><b style="color:#97C459">${pc(S.bestWeekEver)}</b><span>best week ever</span></div>
      <div class="stx-tile"><b style="color:#AFA9EC">${S.bestMonthEver ? S.bestMonthEver.name + ' · ' + S.bestMonthEver.pct + '%' : '–'}</b><span>best month ever</span></div>
    </div>
    <div class="stx-cta">Full honest breakdown → 📈 Insights in your sheet</div>
    </div>`;
    bindBack();
  }
  function bindBack() { const b = $('.stx-back', panel); if (b) b.onclick = closePanel; }

  async function load() {
    try {
      const r = await fetch(API + '/get-stats');
      S = await r.json();
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
    const dots = ['●○○○','○●○○','○○●○','○○○●'][step];
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
      <div class="obx-s" style="text-align:left">We filled in six classics — make them yours, or keep them.</div>
      <div class="obx-lbl" style="color:#F09595">▼ AVOID</div>
      ${obHabits.bad.map((h, i) => `<div class="obx-item"><input data-t="bad" data-i="${i}" value="${h}"></div>`).join('')}
      <div class="obx-lbl" style="color:#97C459">▲ BUILD</div>
      ${obHabits.good.map((h, i) => `<div class="obx-item"><input data-t="good" data-i="${i}" value="${h}"></div>`).join('')}
      <button class="obx-btn" id="obx-next">Keep these ✓</button>
      <div class="obx-foot">min 3 + 3 · tap a name to edit it</div></div>`;
    if (step === 2) ob.innerHTML = `<div class="obx-wrap">
      <div class="obx-dots">${dots}</div>
      <div class="obx-t" style="text-align:left">Pick your focus</div>
      <div class="obx-s" style="text-align:left">One to build, one to eliminate — 30 days of extra attention.</div>
      <div class="obx-lbl" style="color:#97C459">▲ BUILDING</div>
      ${obHabits.good.map(h => `<div class="obx-item ${focus.good === h ? 'sel' : ''}" data-fg="${h}"><span>${focus.good === h ? '●' : '○'} ${h}</span></div>`).join('')}
      <div class="obx-lbl" style="color:#F09595">▼ ELIMINATING</div>
      ${obHabits.bad.map(h => `<div class="obx-item ${focus.bad === h ? 'selbad' : ''}" data-fb="${h}"><span>${focus.bad === h ? '●' : '○'} ${h}</span></div>`).join('')}
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
    ob.querySelectorAll('[data-fg]').forEach(el => el.onclick = () => { focus.good = el.dataset.fg; obRender(); });
    ob.querySelectorAll('[data-fb]').forEach(el => el.onclick = () => { focus.bad = el.dataset.fb; obRender(); });
    const next = $('#obx-next', ob);
    if (next) next.onclick = obNext;
  }

  async function obNext() {
    if (step === 1) {
      obHabits.bad = obHabits.bad.map(s => s.trim()).filter(Boolean);
      obHabits.good = obHabits.good.map(s => s.trim()).filter(Boolean);
      if (obHabits.bad.length < 3 || obHabits.good.length < 3) {
        alert('You need at least 3 good and 3 bad habits.'); return;
      }
      focus.good = obHabits.good[0]; focus.bad = obHabits.bad[0];
    }
    if (step === 3) { await obFinish(); return; }
    step++; obRender();
  }

  async function obFinish() {
    const btn = $('#obx-next', ob);
    btn.disabled = true; btn.textContent = 'Setting up…';
    try {
      // rename changed habits via existing endpoint
      for (const type of ['bad', 'good']) {
        for (let i = 0; i < obHabits[type].length; i++) {
          const oldName = obOrig[type][i];
          const newName = obHabits[type][i];
          if (oldName && newName && oldName !== newName) {
            await fetch(API + '/update-config', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'replace', type, name: oldName, newName })
            });
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
