// App shell: hash router, views, local persistence.
(function () {
  'use strict';
  const OA = window.OA;
  const C = OA.calc;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const view = $('#view');
  const titleEl = $('#title');
  const backBtn = $('#backBtn');
  const APP = '加密学堂';

  // ---------- storage ----------
  const KEY = 'crypto-academy.v1';
  const toolDefaults = () => ({
    tab: 'perp',
    perp: { side: 'long', E: 60000, L: 10, M: 1000, mmr: 0.5, fr: 0.01, days: 7, T: 63000 },
    il: { p0: 3000, p1: 4500, V: 10000, apr: 20, days: 30 },
    tok: { ref: 200, bid: 201.2, ask: 203, amt: 5000, fee: 0.1, exit: 204 },
  });
  const defaults = () => ({
    read: {}, answered: {}, wrong: [], wrongGen: [], genStats: { n: 0, c: 0 },
    cards: {}, newDay: { d: 0, n: 0 }, flashTrack: 'all', tool: toolDefaults(),
  });
  let store = (() => {
    try {
      const s = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}'));
      const td = toolDefaults();
      s.tool = Object.assign(td, s.tool);
      ['perp', 'il', 'tok'].forEach((k) => { s.tool[k] = Object.assign(toolDefaults()[k], s.tool[k]); });
      return s;
    } catch (e) { return defaults(); }
  })();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage full or disabled */ }
  }

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d = 2) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const money = (v, d) => {
    const dd = d != null ? d : (Math.abs(v) >= 1000 ? 0 : 2);
    return (v < 0 ? '−$' : '$') + num(Math.abs(v), dd);
  };
  const plMoney = (v, d) => (Math.abs(v) < 0.005 ? '$0' : (v > 0 ? '+' : '−') + money(Math.abs(v), d));
  const pctS = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v) * 100, d) + '%';
  const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
  const opt = (val, label, cur) => `<option value="${val}"${String(val) === String(cur) ? ' selected' : ''}>${label}</option>`;
  const trackOf = (id) => OA.tracks.find((t) => t.id === id);

  let backHandler = null;
  function setHeader(title, back) {
    titleEl.textContent = title;
    document.title = title === APP ? APP : title + ' · ' + APP;
    backHandler = back || null;
    backBtn.hidden = !back;
  }
  backBtn.addEventListener('click', () => backHandler && backHandler());

  function setTab(name) {
    $$('.tabbar a').forEach((a) => (a.dataset.tab === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  }
  const go = (hash) => { location.hash = hash; };

  function segHtml(items, cur, label, extra = '') {
    return `<div class="seg ${extra}" role="tablist" aria-label="${label}">${items.map(([k, t]) => `<button role="tab" data-seg="${k}" aria-selected="${k === cur}">${t}</button>`).join('')}</div>`;
  }
  function bindSeg(host, onPick) {
    $$('[data-seg]', host).forEach((b) => (b.onclick = () => {
      $$('[data-seg]', host).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      onPick(b.dataset.seg);
    }));
  }

  // Keyboard handler for the active view (flashcards); cleared on every route.
  let onKey = null;
  document.addEventListener('keydown', (e) => {
    const el = e.target instanceof Element ? e.target : document.body;
    if (!onKey || el.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    onKey(e, el);
  });

  // ---------- router ----------
  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(qs || '');
    const name = parts[0] || 'learn';
    onKey = null;
    const routes = { learn: renderLearn, lesson: renderLesson, quiz: renderQuizHome, flash: renderFlashHome, tool: renderTool, me: renderMe, glossary: renderGlossary };
    (routes[name] || renderLearn)(parts.slice(1), params);
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  // Tapping the active tab again (e.g. mid-quiz) should return to that tab's home.
  $$('.tabbar a').forEach((a) => a.addEventListener('click', () => {
    if (location.hash === a.getAttribute('href')) route();
  }));

  // ---------- learn ----------
  const lessonsOf = (track) => OA.lessons.filter((l) => l.track === track);

  const lessonItem = (l) => `<li><a class="list-item" href="#/lesson/${l.id}">
    <span class="num" aria-hidden="true">${l.no}</span>
    <span class="grow"><strong>${esc(l.title)}</strong><span class="small muted block">${esc(l.summary)}</span></span>
    ${store.read[l.id] ? '<span class="check" aria-label="已完成">✓</span>' : ''}
  </a></li>`;

  function renderLearn() {
    setHeader(APP);
    setTab('learn');
    const all = OA.lessons;
    const done = all.filter((l) => store.read[l.id]).length;
    const nextL = all.find((l) => !store.read[l.id]);
    view.innerHTML = `
<section class="card hero">
  <h2>区块链与加密货币学习路线</h2>
  <p class="muted">共 ${all.length} 章，分四部分：基础原理、链上生态、交易与衍生品、风险与监管。每章有大白话解释、案例、练习题，和你熟悉的美股知识做了对照。</p>
  <div class="progress" role="progressbar" aria-label="学习进度" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${done}"><div style="width:${(done / all.length) * 100}%"></div></div>
  <p class="small muted">已完成 ${done} / ${all.length} 章</p>
  ${nextL ? `<a class="btn primary block" href="#/lesson/${nextL.id}">${done ? '继续学习' : '开始学习'}：第 ${nextL.no} 章 ${esc(nextL.title)}</a>` : '<p class="small">全部章节已学完，可以去题库和闪卡巩固。</p>'}
  <a class="btn block" href="#/glossary">📚 术语表：${OA.glossary.length} 个术语的大白话解释</a>
</section>
${OA.tracks.map((t) => {
    const L = lessonsOf(t.id);
    const d = L.filter((l) => store.read[l.id]).length;
    return `<h3 class="section-title">${esc(t.title)} <span class="small">${d}/${L.length}</span></h3>
<p class="small muted part-desc">${esc(t.desc)}</p>
<ol class="list">${L.map(lessonItem).join('')}</ol>`;
  }).join('')}`;
  }

  function renderLesson(args) {
    const l = OA.lessons.find((x) => x.id === Number(args[0]));
    if (!l) return go('#/learn');
    const L = OA.lessons;
    const idx = L.indexOf(l);
    const prev = L[idx - 1], next = L[idx + 1];
    setHeader(`第 ${l.no} 章 · ${trackOf(l.track).name}`, () => go('#/learn'));
    setTab('learn');
    const qs = OA.questions.bank.filter((q) => q.ch === l.id);
    const cards = OA.glossary.filter((g) => g.ch === l.id).length;
    view.innerHTML = `
<article class="card lesson"><h2>${esc(l.title)}</h2>
  ${l.easy ? `<section class="easy" aria-label="大白话"><p class="easy-tag">💡 大白话</p>${l.easy}</section>` : ''}
  <p class="small muted term-hint">文中带下划线的词，点一下就能看解释。</p>
  ${l.html}
  ${l.cases ? `<section class="cases" aria-label="案例"><h3>📖 案例</h3>${l.cases}</section>` : ''}
</article>
<div class="btn-row">
  ${qs.length ? `<button class="btn" id="practice">本章练习（${qs.length} 题）</button>` : ''}
  ${cards ? `<a class="btn" href="#/flash/ch/${l.id}">本章闪卡（${cards} 张）</a>` : ''}
  <button class="btn primary" id="done">${store.read[l.id] ? '已学完 ✓ 下一章' : '标记已学完'}</button>
</div>
<nav class="pager" aria-label="章节导航">
  ${prev ? `<a href="#/lesson/${prev.id}">‹ ${esc(prev.title)}</a>` : '<span></span>'}
  ${next ? `<a href="#/lesson/${next.id}">${esc(next.title)} ›</a>` : '<span></span>'}
</nav>`;
    $('#done').onclick = () => {
      store.read[l.id] = true;
      save();
      go(next ? '#/lesson/' + next.id : '#/learn');
    };
    if (qs.length) $('#practice').onclick = () => startQuiz(() => qs, `第 ${l.no} 章练习`, () => renderLesson(args));
    linkTerms($('.lesson'));
  }

  // ---------- glossary ----------
  const gloss = OA.glossary;
  // Longest patterns first so "流动性质押" wins over "质押".
  const NO_AUTO_LINK = new Set(['区块链', '代币', '地址', '节点']); // too common to underline in every lesson
  const glossPatterns = gloss
    .flatMap((g, i) => (NO_AUTO_LINK.has(g.term) ? [] : [g.term, ...g.aliases].map((p) => ({ p, i }))))
    .sort((a, b) => b.p.length - a.p.length);
  const SKIP = new Set(['CODE', 'A', 'BUTTON', 'H2', 'H3', 'H4', 'TH', 'SCRIPT']);
  const isAscii = (s) => /^[\x20-\x7e]+$/.test(s);
  // For each pattern, the longer glossary patterns that contain it (e.g. 质押 -> 再质押)
  const longerOf = new Map(glossPatterns.map(({ p }) => [p, glossPatterns.map((x) => x.p).filter((q) => q.length > p.length && q.includes(p))]));
  function insideLonger(t, at, p) {
    return longerOf.get(p).some((q) => {
      for (let o = q.indexOf(p); o >= 0; o = q.indexOf(p, o + 1)) if (t.substr(at - o, q.length) === q) return true;
      return false;
    });
  }

  // Wrap the first occurrence of each glossary term in a tappable button.
  function linkTerms(rootEl) {
    if (!rootEl || !gloss.length) return;
    const used = new Set();
    const accept = (node) => {
      for (let el = node.parentElement; el && el !== rootEl; el = el.parentElement) {
        if (SKIP.has(el.tagName) || el.classList.contains('formula') || el.classList.contains('term') || el.classList.contains('us-tag')) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    };
    for (const { p, i } of glossPatterns) {
      if (used.has(i)) continue;
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: accept });
      let node;
      while ((node = walker.nextNode())) {
        const t = node.nodeValue;
        let at = t.indexOf(p);
        // ASCII terms must not sit inside a longer word (e.g. "LP" in "LPs" or "HELP").
        const bad = (k) => insideLonger(t, k, p) ||
          (isAscii(p) && (/[A-Za-z0-9-]/.test(t[k - 1] || '') || /[A-Za-z0-9-]/.test(t[k + p.length] || '')));
        while (at >= 0 && bad(at)) at = t.indexOf(p, at + 1);
        if (at < 0) continue;
        const after = node.splitText(at);
        after.splitText(p.length);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'term';
        btn.dataset.g = String(i);
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.textContent = p;
        after.parentNode.replaceChild(btn, after);
        used.add(i);
        break;
      }
    }
  }

  const sheet = $('#termSheet');
  function openTerm(i) {
    const g = gloss[i];
    if (!g || !sheet) return;
    $('#termTitle').textContent = g.term + (g.aliases.length ? `（${g.aliases.join(' / ')}）` : '');
    $('#termDef').textContent = g.def;
    const us = $('#termUs');
    us.hidden = !g.us;
    us.textContent = g.us ? '美股对照：' + g.us : '';
    if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.term');
    if (b) openTerm(Number(b.dataset.g));
  });
  if (sheet) {
    $('#termClose').addEventListener('click', () => (sheet.close ? sheet.close() : sheet.removeAttribute('open')));
    sheet.addEventListener('click', (e) => { if (e.target === sheet && sheet.close) sheet.close(); }); // tap backdrop
  }

  const chapterLabel = (ch) => {
    const l = OA.lessons.find((x) => x.id === ch);
    return l ? `第 ${l.no} 章 ${l.title}` : '';
  };

  function renderGlossary() {
    setHeader('术语表', () => go('#/learn'));
    setTab('learn');
    view.innerHTML = `
<section class="card">
  <label class="field"><span>搜索术语</span><input type="search" id="gq" placeholder="例如：资金费率、LP、助记词" autocomplete="off"></label>
  <p class="small muted">共 ${gloss.length} 个术语，带"美股对照"的条目标出了和你熟悉概念的异同。</p>
</section>
<dl class="gloss" id="glist"></dl>`;
    const list = $('#glist'), q = $('#gq');
    const draw = () => {
      const k = q.value.trim().toLowerCase();
      const hits = gloss.filter((g) => !k || [g.term, ...g.aliases, g.def, g.us].some((s) => s.toLowerCase().includes(k)));
      list.innerHTML = hits.length
        ? hits.map((g) => `<div class="gloss-item"><dt>${esc(g.term)}${g.aliases.length ? ` <span class="small muted">${esc(g.aliases.join(' / '))}</span>` : ''}</dt><dd>${esc(g.def)}${g.us ? `<span class="small block"><span class="us-tag">美股对照</span>：${esc(g.us)}</span>` : ''}<a class="small" href="#/lesson/${g.ch}">${esc(chapterLabel(g.ch))}</a></dd></div>`).join('')
        : '<p class="small muted">没有找到相关术语。</p>';
    };
    q.addEventListener('input', draw);
    draw();
  }

  // ---------- quiz ----------
  const bankById = Object.fromEntries(OA.questions.bank.map((q) => [q.id, q]));
  function chapterName(ch) {
    if (ch === 'calc') return '计算题';
    const l = OA.lessons.find((x) => x.id === ch);
    return l ? `第 ${l.no} 章` : '';
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function prepare(q) {
    const idx = q.o.map((_, k) => k);
    if (!q.noShuffle) shuffle(idx);
    return Object.assign({}, q, { opts: idx.map((k) => q.o[k]), ans: idx.indexOf(q.a) });
  }
  function record(q, ok) {
    if (q.gen) {
      store.genStats.n++;
      if (ok) {
        store.genStats.c++;
        store.wrongGen = store.wrongGen.filter((x) => x.id !== q.id);
      } else if (!store.wrongGen.some((x) => x.id === q.id)) {
        store.wrongGen.push({ id: q.id, ch: q.ch, q: q.q, o: q.o, a: q.a, e: q.e, gen: true });
        if (store.wrongGen.length > 50) store.wrongGen.shift();
      }
    } else {
      store.answered[q.id] = { c: ok };
      if (ok) store.wrong = store.wrong.filter((x) => x !== q.id);
      else if (!store.wrong.includes(q.id)) store.wrong.push(q.id);
    }
    save();
  }
  function quizStats() {
    const ids = Object.keys(store.answered);
    const n = ids.length + store.genStats.n;
    const c = ids.filter((k) => store.answered[k].c).length + store.genStats.c;
    return { n, c };
  }
  const wrongList = () => [...store.wrong.map((id) => bankById[id]).filter(Boolean), ...store.wrongGen];

  function renderQuizHome() {
    setHeader('题库');
    setTab('quiz');
    const bank = OA.questions.bank;
    const st = quizStats();
    const wrongN = wrongList().length;
    const chapterRow = (l) => {
      const qs = bank.filter((q) => q.ch === l.id);
      if (!qs.length) return '';
      const done = qs.filter((q) => store.answered[q.id]).length;
      return `<li><button class="list-item" data-ch="${l.id}">
      <span class="num" aria-hidden="true">${l.no}</span>
      <span class="grow"><strong>${esc(l.title)}</strong><span class="small muted block">${qs.length} 题 · 已做 ${done}</span></span>
      <span aria-hidden="true" class="muted">›</span></button></li>`;
    };
    view.innerHTML = `
<section class="card"><div class="stats3">
  <div><b>${st.n}</b><span>已答题次</span></div>
  <div><b>${st.n ? Math.round((st.c / st.n) * 100) : 0}%</b><span>正确率</span></div>
  <div><b>${wrongN}</b><span>错题</span></div>
</div></section>
<div class="tiles">
  <button class="tile" id="qRandom"><strong>随机 10 题</strong><span>全部 ${bank.length} 道概念题中抽取</span></button>
  <button class="tile" id="qCalc"><strong>计算题训练</strong><span>强平价、资金费、无常损失等，随机生成</span></button>
  <button class="tile" id="qWrong"${wrongN ? '' : ' disabled'}><strong>错题本</strong><span>${wrongN ? wrongN + ' 道，答对自动移出' : '暂无错题'}</span></button>
  <button class="tile" id="qAll"><strong>全部概念题</strong><span>${bank.length} 道，按章节顺序</span></button>
</div>
${OA.tracks.map((t) => `<h3 class="section-title">${esc(t.title)}</h3><ul class="list">${lessonsOf(t.id).map(chapterRow).join('')}</ul>`).join('')}`;
    const home = () => renderQuizHome();
    const ordered = () => OA.lessons.flatMap((l) => bank.filter((q) => q.ch === l.id));
    $('#qRandom').onclick = () => startQuiz(() => shuffle(bank.slice()).slice(0, 10), '随机 10 题', home);
    $('#qCalc').onclick = () => startQuiz(() => OA.questions.generate(10), '计算题训练', home);
    $('#qWrong').onclick = () => startQuiz(wrongList, '错题本', home);
    $('#qAll').onclick = () => startQuiz(ordered, '全部概念题', home);
    $$('[data-ch]').forEach((b) => (b.onclick = () => {
      const ch = Number(b.dataset.ch);
      startQuiz(() => bank.filter((q) => q.ch === ch), `${chapterName(ch)}练习`, home);
    }));
  }

  function startQuiz(factory, title, onBack) {
    const list = factory();
    if (!list.length) return onBack();
    const qs = list.map(prepare);
    let i = 0, right = 0;

    function show() {
      setHeader(title, onBack);
      const q = qs[i];
      view.innerHTML = `
<p class="small muted">第 ${i + 1} / ${qs.length} 题 · ${chapterName(q.ch)}</p>
<div class="progress thin" aria-hidden="true"><div style="width:${(i / qs.length) * 100}%"></div></div>
<section class="card">
  <p class="q" id="qText">${esc(q.q)}</p>
  <div class="opts" role="group" aria-labelledby="qText">
    ${q.opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="key" aria-hidden="true">${'ABCD'[k]}</span><span>${esc(o)}</span></button>`).join('')}
  </div>
  <div id="fb" aria-live="polite"></div>
</section>`;
      $$('.opt').forEach((b) => (b.onclick = () => answer(Number(b.dataset.k))));
      window.scrollTo(0, 0);
    }

    function answer(k) {
      const q = qs[i];
      const ok = k === q.ans;
      if (ok) right++;
      record(q, ok);
      $$('.opt').forEach((b, j) => {
        b.disabled = true;
        if (j === q.ans) { b.classList.add('correct'); b.setAttribute('aria-label', '正确答案：' + q.opts[j]); }
        else if (j === k) { b.classList.add('wrong'); b.setAttribute('aria-label', '你的选择：' + q.opts[j]); }
      });
      $('#fb').innerHTML = `
<div class="feedback ${ok ? 'ok' : 'no'}"><strong>${ok ? '回答正确' : '回答错误，正确答案是 ' + 'ABCD'[q.ans]}</strong><p>${esc(q.e)}</p></div>
<button class="btn primary block" id="next">${i + 1 < qs.length ? '下一题' : '查看结果'}</button>`;
      const nextBtn = $('#next');
      nextBtn.onclick = () => { i++; if (i < qs.length) show(); else finish(); };
      nextBtn.focus({ preventScroll: true });
      nextBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function finish() {
      setHeader(title, onBack);
      const pct = Math.round((right / qs.length) * 100);
      view.innerHTML = `
<section class="card center">
  <p class="muted">本轮结果</p>
  <h2 class="score">${right} / ${qs.length}</h2>
  <p class="muted">正确率 ${pct}%</p>
  <p>${pct >= 80 ? '掌握得不错，可以继续下一章，或去闪卡巩固术语。' : '建议回看相关章节，再刷一遍错题本。'}</p>
</section>
<div class="btn-row">
  <button class="btn" id="again">再来一轮</button>
  <button class="btn primary" id="back">返回</button>
</div>`;
      $('#again').onclick = () => startQuiz(factory, title, onBack);
      $('#back').onclick = onBack;
    }
    show();
  }

  // ---------- flashcards (simplified Anki / SM-2 spaced repetition) ----------
  const NEW_PER_DAY = 15;
  const today = () => {
    const d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  };
  const cardOf = (g) => store.cards[g.term];
  const deckOf = (track) => gloss.filter((g) => {
    if (track === 'all') return true;
    const l = OA.lessons.find((x) => x.id === g.ch);
    return l && l.track === track;
  });
  function newLeftToday() {
    if (store.newDay.d !== today()) store.newDay = { d: today(), n: 0 };
    return Math.max(0, NEW_PER_DAY - store.newDay.n);
  }
  // Returns the next state for grade g: 0 重来, 1 困难, 2 记得, 3 简单
  function schedule(c, g) {
    const s = Object.assign({ ivl: 0, ease: 2.5, reps: 0, lapses: 0 }, c);
    if (g === 0) {
      s.ivl = 0; s.ease = Math.max(1.3, s.ease - 0.2); s.lapses++;
    } else if (g === 1) {
      s.ivl = s.ivl ? Math.max(1, Math.round(s.ivl * 1.2)) : 1; s.ease = Math.max(1.3, s.ease - 0.15);
    } else if (g === 2) {
      s.ivl = s.ivl === 0 ? 1 : s.ivl === 1 ? 3 : Math.max(s.ivl + 1, Math.round(s.ivl * s.ease));
    } else {
      s.ivl = s.ivl === 0 ? 4 : Math.max(s.ivl + 2, Math.round(s.ivl * s.ease * 1.3)); s.ease += 0.15;
    }
    s.reps++;
    s.due = today() + s.ivl;
    return s;
  }
  const ivlLabel = (d) => (d === 0 ? '<10 分钟' : d < 30 ? `${d} 天` : d < 365 ? `${Math.round(d / 30)} 个月` : `${(d / 365).toFixed(1)} 年`);

  function renderFlashHome(args) {
    if (args[0] === 'ch') return startFlash(gloss.filter((g) => g.ch === Number(args[1])), `第 ${OA.lessons.find((l) => l.id === Number(args[1]))?.no || ''} 章闪卡`, false, () => go('#/lesson/' + args[1]));
    setHeader('闪卡');
    setTab('flash');
    const track = store.flashTrack;
    const deck = deckOf(track);
    const t = today();
    const due = deck.filter((g) => cardOf(g) && cardOf(g).due <= t);
    const fresh = deck.filter((g) => !cardOf(g));
    const newN = Math.min(fresh.length, newLeftToday());
    const learned = gloss.filter((g) => cardOf(g)).length;
    const mature = gloss.filter((g) => cardOf(g) && cardOf(g).ivl >= 21).length;
    view.innerHTML = `
<section class="card"><div class="stats3">
  <div><b>${due.length}</b><span>今日待复习</span></div>
  <div><b>${newN}</b><span>今日新卡</span></div>
  <div><b>${learned}/${gloss.length}</b><span>已学 · 熟练 ${mature}</span></div>
</div></section>
<label class="field"><span>卡组范围</span>
  <select id="ft">${opt('all', '全部术语', track)}${OA.tracks.map((x) => opt(x.id, esc(x.title), track)).join('')}</select>
</label>
<div class="tiles">
  <button class="tile" id="fStart"${due.length + newN ? '' : ' disabled'}><strong>开始今日学习</strong><span>${due.length + newN ? `复习 ${due.length} 张 + 新卡 ${newN} 张` : '今天的卡片都完成了'}</span></button>
  <button class="tile" id="fCram"><strong>随便翻翻</strong><span>随机 20 张，不影响复习计划</span></button>
</div>
<section class="card">
  <h3>这是什么</h3>
  <p class="small">闪卡就是 Anki 那种"间隔重复"记忆法：正面是术语，你先在心里回答，再翻到背面对答案，然后给自己打分。</p>
  <ul class="small">
    <li><b>重来</b>：没想起来，这一轮稍后再出现。</li>
    <li><b>困难 / 记得 / 简单</b>：按记忆程度，下次在几天、几周甚至几个月后再出现。</li>
  </ul>
  <p class="small muted">记得越牢，复习间隔越长。每天花几分钟，比一次刷几小时记得更久。电脑上可以用空格翻面，数字键 1–4 打分。</p>
</section>`;
    $('#ft').onchange = (e) => { store.flashTrack = e.target.value; save(); renderFlashHome([]); };
    $('#fStart').onclick = () => startFlash(shuffle(due.slice()).concat(fresh.slice(0, newN)), '今日学习', true, () => renderFlashHome([]));
    $('#fCram').onclick = () => startFlash(shuffle(deck.slice()).slice(0, 20), '随便翻翻', false, () => renderFlashHome([]));
  }

  function startFlash(cards, title, scheduled, onBack) {
    if (!cards.length) return onBack();
    const queue = cards.slice();
    const total = queue.length;
    let doneN = 0, flipped = false;

    function show() {
      setHeader(title, onBack);
      setTab('flash');
      if (!queue.length) return finish();
      const g = queue[0];
      const c = cardOf(g);
      flipped = false;
      view.innerHTML = `
<p class="small muted">剩余 ${queue.length} 张 · 已完成 ${doneN} / ${total}${scheduled && !c ? ' · <b>新卡</b>' : ''}</p>
<div class="progress thin" aria-hidden="true"><div style="width:${(doneN / total) * 100}%"></div></div>
<section class="card fc" aria-live="polite">
  <p class="fc-term">${esc(g.term)}</p>
  ${g.aliases.length ? `<p class="fc-alias">${esc(g.aliases.join(' / '))}</p>` : ''}
  <div id="back"></div>
</section>
<div id="actions"><button class="btn primary block" id="flip">显示答案 <span class="kbd" aria-hidden="true">空格</span></button></div>`;
      $('#flip').onclick = flip;
      $('#flip').focus({ preventScroll: true });
    }

    function flip() {
      if (flipped) return;
      flipped = true;
      const g = queue[0];
      $('#back').innerHTML = `<div class="fc-back">
  <p>${esc(g.def)}</p>
  ${g.us ? `<p class="small"><span class="us-tag">美股对照</span>：${esc(g.us)}</p>` : ''}
  <p class="small"><a href="#/lesson/${g.ch}">${esc(chapterLabel(g.ch))}</a></p>
</div>`;
      if (scheduled) {
        const c = cardOf(g);
        const labels = ['重来', '困难', '记得', '简单'];
        const klass = ['again', '', 'good', ''];
        $('#actions').innerHTML = `<div class="grades" role="group" aria-label="记忆程度">${labels.map((t, k) => `<button class="btn ${klass[k]}" data-g="${k}">${t}<small>${ivlLabel(schedule(c, k).ivl)}</small></button>`).join('')}</div>`;
        $$('[data-g]').forEach((b) => (b.onclick = () => grade(Number(b.dataset.g))));
        $('[data-g="2"]').focus({ preventScroll: true });
      } else {
        $('#actions').innerHTML = `<button class="btn primary block" id="nextCard">下一张 <span class="kbd" aria-hidden="true">空格</span></button>`;
        $('#nextCard').onclick = () => { queue.shift(); doneN++; show(); };
        $('#nextCard').focus({ preventScroll: true });
      }
    }

    function grade(k) {
      const g = queue.shift();
      const wasNew = !cardOf(g);
      store.cards[g.term] = schedule(cardOf(g), k);
      if (wasNew) { newLeftToday(); store.newDay.n++; }
      save();
      if (k === 0) queue.push(g); // see it again later in this session
      else doneN++;
      show();
    }

    function finish() {
      onKey = null;
      setHeader(title, onBack);
      view.innerHTML = `
<section class="card center">
  <p class="muted">本轮完成</p>
  <h2 class="score">${doneN} 张</h2>
  <p>${scheduled ? '复习计划已更新，明天再来。' : '想记得更牢，就用"开始今日学习"，系统会按记忆程度安排复习。'}</p>
</section>
<div class="btn-row"><button class="btn primary" id="back">返回</button></div>`;
      $('#back').onclick = onBack;
    }

    onKey = (e, el) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (el.closest('a, button')) return; // focused controls handle their own activation
        e.preventDefault();
        if (!flipped) flip();
        else if (!scheduled && $('#nextCard')) $('#nextCard').click();
        else if (scheduled && e.key === ' ') grade(2);
      } else if (flipped && scheduled && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key) - 1);
      }
    };
    show();
  }

  // ---------- calculator tools ----------
  const numField = (key, label, val, step, extra = '') =>
    `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" data-f="${key}" value="${val}" step="${step}" ${extra}></label>`;
  const kvTable = (rows) => `<table class="kv">${rows.map(([k, v, h]) => `<tr><th scope="row">${k}</th><td><b>${v}</b>${h ? `<span class="small muted block">${h}</span>` : ''}</td></tr>`).join('')}</table>`;
  function bindFields(host, state, out, guards = {}) {
    $$('[data-f]', host).forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = el.dataset.f;
      if (el.tagName === 'SELECT') state[k] = el.value;
      else {
        const v = parseFloat(el.value);
        if (!isFinite(v) || (guards[k] && !guards[k](v))) return;
        state[k] = v;
      }
      save();
      out();
    }));
    out();
  }

  function renderTool(args, params) {
    const t = params.get('t');
    if (t && ['perp', 'il', 'tok'].includes(t)) store.tool.tab = t;
    if (params.toString()) history.replaceState(null, '', '#/tool');
    save();
    setHeader('计算器');
    setTab('tool');
    view.innerHTML = `
<div id="toolSeg">${segHtml([['perp', '永续合约'], ['il', '无常损失'], ['tok', '代币化股票']], store.tool.tab, '计算器类型', 'three')}</div>
<div id="toolBody"></div>
<p class="note small muted">计算采用简化公式，仅用于学习。实际以交易所和协议的规则为准，不构成投资建议。</p>`;
    bindSeg($('#toolSeg'), (k) => { store.tool.tab = k; save(); body(); });
    const body = () => ({ perp: toolPerp, il: toolIl, tok: toolTok })[store.tool.tab]();
    body();
  }

  function toolPerp() {
    const s = store.tool.perp;
    const host = $('#toolBody');
    host.innerHTML = `
<section class="card">
  <h3>仓位参数</h3>
  <div class="grid2">
    <label class="field"><span>方向</span><select data-f="side">${opt('long', '做多', s.side)}${opt('short', '做空', s.side)}</select></label>
    ${numField('E', '开仓价（USDT）', s.E, 'any', 'min="0"')}
    ${numField('L', '杠杆（倍）', s.L, '1', 'min="1" max="125"')}
    ${numField('M', '保证金（USDT）', s.M, 'any', 'min="0"')}
    ${numField('mmr', '维持保证金率 %', s.mmr, '0.1', 'min="0"')}
    ${numField('fr', '资金费率 %/8 小时', s.fr, '0.001')}
    ${numField('days', '持有天数', s.days, '1', 'min="0"')}
    ${numField('T', '假设目标价', s.T, 'any', 'min="0"')}
  </div>
</section>
<section class="card"><h3>结果</h3><div id="perpOut" aria-live="polite"></div></section>
<p class="small muted">逐仓、线性（USDT 本位）合约，忽略开平仓手续费与强平费。资金费按开仓时的名义价值估算。</p>`;
    const out = () => {
      const notional = s.M * s.L, qty = notional / s.E, mmr = s.mmr / 100;
      const liq = C.liqPrice(s.side, s.E, s.L, mmr);
      const dist = liq / s.E - 1;
      const periods = s.days * 3;
      const fund = C.fundingPaid(s.side, notional, s.fr / 100, periods);
      const pnl = C.perpPnl(s.side, s.E, s.T, qty);
      const hitLiq = s.side === 'long' ? s.T <= liq : s.T >= liq;
      const net = hitLiq ? -s.M : pnl - fund;
      const pd = s.E < 10 ? 4 : 2;
      const valid = mmr < 1 && s.L >= 1 && s.E > 0 && s.M > 0;
      $('#perpOut').innerHTML = !valid ? '<p class="small">请检查输入：价格、保证金需大于 0，杠杆至少 1 倍，维持保证金率小于 100%。</p>' : kvTable([
        ['名义价值', money(notional), `持仓数量 ${num(qty, qty < 1 ? 6 : 4)}`],
        ['强平价', money(liq, pd), `距开仓价 ${pctS(dist)}${s.L === 1 && s.side === 'long' ? '（1 倍做多基本不会被强平）' : ''}`],
        ['价格每变动 1%', `保证金 ±${num(s.L, 0)}%`, `约 ${money(notional * 0.01)}`],
        ['资金费（多空互付）', `<span class="${cls(-fund)}">${plMoney(-fund)}</span>`, `${s.days} 天共 ${periods} 次结算；${fund >= 0 ? '你在支付' : '你在收取'}，约占保证金 ${num(Math.abs(fund) / s.M * 100, 2)}%`],
        ['到目标价的盈亏', hitLiq ? `<span class="neg">${plMoney(-s.M)}</span>` : `<span class="${cls(pnl)}">${plMoney(pnl)}</span>`, hitLiq ? '到达目标价前已被强平，约亏掉全部保证金' : `收益率 ${pctS(pnl / s.M)}`],
        ['计入资金费后', `<span class="${cls(net)}">${plMoney(net)}</span>`, hitLiq ? '' : `收益率 ${pctS(net / s.M)}`],
      ]);
    };
    bindFields(host, s, out, { E: (v) => v > 0, L: (v) => v >= 1, M: (v) => v > 0, mmr: (v) => v >= 0 && v < 100, days: (v) => v >= 0, T: (v) => v > 0 });
  }

  function toolIl() {
    const s = store.tool.il;
    const host = $('#toolBody');
    host.innerHTML = `
<section class="card">
  <h3>LP 参数（50/50 恒定乘积池）</h3>
  <div class="grid2">
    ${numField('p0', '存入时价格', s.p0, 'any', 'min="0"')}
    ${numField('p1', '现在价格', s.p1, 'any', 'min="0"')}
    ${numField('V', '存入总价值（美元）', s.V, 'any', 'min="0"')}
    ${numField('apr', '手续费年化 %', s.apr, '0.1', 'min="0"')}
    ${numField('days', '已做 LP 天数', s.days, '1', 'min="0"')}
  </div>
</section>
<section class="card"><h3>结果</h3><div id="ilOut" aria-live="polite"></div></section>
<p class="small muted">价格指波动币相对稳定币（如 ETH/USDC）的价格。手续费按存入价值和固定年化粗略估算，实际随交易量变化。</p>`;
    const out = () => {
      const r = s.p1 / s.p0;
      const il = C.impermanentLoss(r);
      const hold = C.holdValue(s.V, r), lp = C.lpValue(s.V, r);
      const fee = s.V * (s.apr / 100) * (s.days / 365);
      const net = lp + fee - hold;
      const be = il < 0 ? (-il * hold) / s.V / (s.apr / 100 || Infinity) * 365 : 0;
      $('#ilOut').innerHTML = kvTable([
        ['价格变化', `${num(r, 4)} 倍`, `${pctS(r - 1)}`],
        ['无常损失', `<span class="neg">${pctS(il)}</span>`, '相对一直持有不动'],
        ['一直持有的价值', money(hold), '一半波动币 + 一半稳定币，不动'],
        ['LP 仓位价值（不含手续费）', money(lp), `比持有少 ${money(hold - lp)}`],
        ['估算手续费收入', `<span class="pos">${plMoney(fee)}</span>`, `${s.days} 天，年化 ${num(s.apr, 1)}%`],
        ['LP 相对持有的净结果', `<span class="${cls(net)}">${plMoney(net)}</span>`, isFinite(be) && be > 0 ? `在这个价格下，手续费约需 ${num(be, 0)} 天才能补平无常损失` : ''],
        ['相对全拿稳定币', `<span class="${cls(lp + fee - s.V)}">${plMoney(lp + fee - s.V)}</span>`, '如果当初什么都不做、只拿美元'],
      ]);
    };
    bindFields(host, s, out, { p0: (v) => v > 0, p1: (v) => v > 0, V: (v) => v > 0, apr: (v) => v >= 0, days: (v) => v >= 0 });
  }

  function toolTok() {
    const s = store.tool.tok;
    const host = $('#toolBody');
    host.innerHTML = `
<section class="card">
  <h3>报价与交易</h3>
  <div class="grid2">
    ${numField('ref', '正股参考价（如周五收盘）', s.ref, 'any', 'min="0"')}
    ${numField('bid', '代币买价 Bid', s.bid, 'any', 'min="0"')}
    ${numField('ask', '代币卖价 Ask', s.ask, 'any', 'min="0"')}
    ${numField('amt', '买入金额（美元）', s.amt, 'any', 'min="0"')}
    ${numField('fee', '单边手续费 %', s.fee, '0.01', 'min="0"')}
    ${numField('exit', '假设卖出价（如周一开盘）', s.exit, 'any', 'min="0"')}
  </div>
</section>
<section class="card"><h3>结果</h3><div id="tokOut" aria-live="polite"></div></section>
<p class="small muted">假设你按 Ask 买入、在假设卖出价成交卖出。实际卖出时还会面对当时的 Bid/Ask 点差。</p>`;
    const out = () => {
      if (!(s.ask >= s.bid)) { $('#tokOut').innerHTML = '<p class="small">卖价 Ask 应不低于买价 Bid。</p>'; return; }
      const mid = (s.bid + s.ask) / 2;
      const prem = C.premium(mid, s.ref), premAsk = C.premium(s.ask, s.ref);
      const spread = (s.ask - s.bid) / mid;
      const f = s.fee / 100;
      const shares = (s.amt * (1 - f)) / s.ask;
      const proceeds = shares * s.exit * (1 - f);
      const pnl = proceeds - s.amt;
      const stockMove = s.exit / s.ref - 1;
      const roundTrip = s.amt * (spread + 2 * f);
      const breakEven = s.ask / ((1 - f) * (1 - f));
      $('#tokOut').innerHTML = kvTable([
        ['中间价溢价', `<span class="${cls(prem)}">${pctS(prem)}</span>`, `按 Ask 买入的溢价 ${pctS(premAsk)}`],
        ['买卖点差', pctS(spread).replace('+', ''), `同价位立刻买卖一个来回约损失 ${money(roundTrip)}（点差 + 两次手续费）`],
        ['买到的数量', num(shares, 4) + ' 股', ''],
        ['不亏的最低卖出价', money(breakEven, 2), `需比参考价高 ${pctS(breakEven / s.ref - 1)}`],
        ['按假设价卖出的盈亏', `<span class="${cls(pnl)}">${plMoney(pnl)}</span>`, `收益率 ${pctS(pnl / s.amt)}；同期正股相对参考价 ${pctS(stockMove)}`],
      ]);
    };
    bindFields(host, s, out, { ref: (v) => v > 0, bid: (v) => v > 0, ask: (v) => v > 0, amt: (v) => v > 0, fee: (v) => v >= 0 && v < 100, exit: (v) => v > 0 });
  }

  // ---------- me ----------
  function renderMe() {
    setHeader('我的');
    setTab('me');
    const st = quizStats();
    const done = OA.lessons.filter((l) => store.read[l.id]).length;
    const learned = gloss.filter((g) => cardOf(g)).length;
    view.innerHTML = `
<section class="card"><div class="stats3">
  <div><b>${done}/${OA.lessons.length}</b><span>已学章节</span></div>
  <div><b>${st.n ? Math.round((st.c / st.n) * 100) : 0}%</b><span>正确率（${st.n} 题次）</span></div>
  <div><b>${learned}/${gloss.length}</b><span>已学闪卡</span></div>
</div></section>
<section class="card">
  <h3>添加到手机桌面</h3>
  <ul class="small">
    <li>iPhone（Safari）：点底部"分享"按钮 → "添加到主屏幕"。</li>
    <li>Android（Chrome）：点右上角菜单 → "添加到主屏幕"或"安装应用"。</li>
  </ul>
  <p class="small muted">通过 HTTPS 访问时支持离线使用。</p>
</section>
<section class="card">
  <h3>数据</h3>
  <p class="small">学习进度、答题记录、闪卡复习计划和计算器设置只保存在本机浏览器里，不会上传。清除浏览器数据会一并清除这些记录。</p>
  <button class="btn danger" id="reset">清除全部学习记录</button>
</section>
<p class="note small muted">本应用仅用于学习区块链与加密资产知识，内容和计算结果均不构成投资建议或法律意见。加密资产价格波动极大，杠杆和衍生品可能亏损全部本金。各地对加密资产的监管不同，参与前请确认所在地法律。时效性内容截至 2026 年 10 月。</p>`;
    $('#reset').onclick = () => {
      if (!confirm('确定清除全部学习进度、答题记录、闪卡计划和计算器设置吗？此操作无法撤销。')) return;
      store = defaults();
      save();
      renderMe();
    };
  }

  // ---------- boot ----------
  if (!location.hash) history.replaceState(null, '', '#/learn');
  route();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
