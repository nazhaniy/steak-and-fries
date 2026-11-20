(function () {
  'use strict';

  /* ---------- Saved progress (this browser only) ---------- */
  var KEY = 'steak-and-fries-v2';
  function freshState() { return { homework: {}, live: {}, history: [], photos: {} }; }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      if (saved) return Object.assign(freshState(), saved);
    } catch (e) { /* storage unavailable: progress lasts for this visit only */ }
    return freshState();
  }
  var state = load();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  var scoreTimer = null;
  function save() {
    clearTimeout(scoreTimer);
    scoreTimer = setTimeout(function () { sendScores(); sendProgress(); }, 1500);
    return persist();
  }

  /* ---------- Helpers ---------- */
  var view = document.getElementById('view');
  var modal = document.getElementById('modal');
  var LETTERS = ['A', 'B', 'C', 'D'];
  var SPRITES = 'assets/sprites/';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function tex(s, display) { return katex.renderToString(s, { throwOnError: false, displayMode: !!display }); }
  /* Text with $maths$ inside it. */
  function rich(s) {
    return String(s).split(/\$([^$]+)\$/).map(function (part, i) { return i % 2 ? tex(part) : esc(part); }).join('');
  }
  function clock(seconds) {
    var s = Math.max(0, seconds);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function art(name, alt, attrs) { return '<img src="' + SPRITES + name + '.webp" alt="' + (alt || '') + '" ' + (attrs || '') + '>'; }
  function hero(eyebrow, title, lead, pictures) {
    return '<section class="hero"><div><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + '</div>' +
      (pictures ? '<div class="hero-art">' + pictures + '</div>' : '') + '</section>';
  }
  function barRow(label, value, pct, attr) {
    return '<div class="bar-row"><span>' + label + '</span><span>' + value + '</span></div><div class="bar"><i ' + (attr || '') + ' style="width:' + pct + '%"></i></div>';
  }
  function toast(text) {
    var previous = document.querySelector('.toast');
    if (previous) previous.remove();
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function dialog(title, text, buttons) {
    modal.innerHTML = '<div class="dialog" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h2>' + title + '</h2><p>' + text + '</p><div class="row">' + buttons + '</div></div>';
    modal.hidden = false;
    var b = modal.querySelector('button');
    if (b) b.focus();
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }

  /* ---------- Reads a typed answer and compares it with the expected one ---------- */
  function evaluate(source, x) {
    var s = source.toLowerCase().replace(/\s+/g, '').replace(/[·×*]/g, '*').replace(/[−–]/g, '-').replace(/√/g, 'sqrt').replace(/π/g, 'pi');
    var i = 0;
    var FUNCTIONS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, sqrt: Math.sqrt, exp: Math.exp, sec: function (v) { return 1 / Math.cos(v); } };
    function sum() {
      var v = product();
      while (s[i] === '+' || s[i] === '-') { var op = s[i++]; var r = product(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    function product() {
      var v = unary();
      for (;;) {
        if (s[i] === '*') { i++; v *= unary(); }
        else if (s[i] === '/') { i++; v /= unary(); }
        else if (i < s.length && /[0-9a-z(.]/.test(s[i])) { v *= power(); } /* 2x means 2 times x */
        else return v;
      }
    }
    function unary() {
      if (s[i] === '-') { i++; return -unary(); }
      if (s[i] === '+') { i++; return unary(); }
      return power();
    }
    function power() {
      var v = atom();
      if (s[i] === '^') { i++; v = Math.pow(v, unary()); }
      return v;
    }
    function atom() {
      if (s[i] === '(') {
        i++;
        var v = sum();
        if (s[i] !== ')') throw new Error('bracket');
        i++;
        return v;
      }
      var m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (m) { i += m[0].length; return parseFloat(m[0]); }
      /* h and t are variables too, for difference quotients like 8 + h and motion like 2t - 4. */
      var names = ['sqrt', 'sin', 'cos', 'tan', 'sec', 'exp', 'ln', 'pi', 'x', 'e', 'h', 't'];
      for (var n = 0; n < names.length; n++) {
        if (s.slice(i, i + names[n].length) === names[n]) {
          var name = names[n];
          i += name.length;
          if (name === 'x') return x;
          if (name === 'h') return x * 0.61 + 0.17;
          if (name === 't') return x * 1.37 + 0.4;
          if (name === 'e') return Math.E;
          if (name === 'pi') return Math.PI;
          if (s[i] === '(') return FUNCTIONS[name](atom());
          /* No brackets: sin 4x and ln 2x mean sin(4x) and ln(2x), so a number takes the variable after it. */
          var startsWithDigit = /[0-9.]/.test(s[i] || ''), arg = power();
          while (startsWithDigit && /[xht]/.test(s[i] || '') && s.slice(i, i + 3) !== 'tan') arg *= power();
          return FUNCTIONS[name](arg);
        }
      }
      throw new Error('unknown');
    }
    var result = sum();
    if (i !== s.length) throw new Error('trailing');
    return result;
  }
  /* true = matches, false = different, null = could not read it. */
  function sameExpression(typed, expected) {
    var right = String(typed).split('=').pop();
    if (!right.trim()) return null;
    try {
      return [0.7, 1.3, 2.3, 3.1].every(function (x) {
        var v = evaluate(right, x);
        if (!isFinite(v)) throw new Error('value');
        return Math.abs(v - evaluate(expected, x)) < 1e-6;
      });
    } catch (e) { return null; }
  }

  /* ---------- Navigation ---------- */
  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="#4b2a16"><path d="M12 2.5 1.5 12h3v9.5h5.5v-6h4v6h5.5V12h3z"/></svg>',
    lessons: '<svg viewBox="0 0 24 24" fill="none" stroke="#4b2a16" stroke-width="1.7" stroke-linejoin="round"><path d="M12 6.5C10 4.6 6.5 4 2.5 4.300v15c4-.3 7.5.3 9.5 2.200 2-1.900 5.500-2.500 9.500-2.200v-15C17.500 4 14 4.600 12 6.500zm0 0v15"/></svg>',
    homework: '<svg viewBox="0 0 24 24" fill="none" stroke="#4b2a16" stroke-width="1.7" stroke-linejoin="round"><rect x="4.500" y="4" width="15" height="18" rx="2"/><rect x="8.500" y="2" width="7" height="4" rx="1" fill="#f6cd97"/><path d="M8 10.500h8M8 14h8M8 17.500h8"/></svg>',
    quizzes: '<svg viewBox="0 0 24 24" fill="none" stroke="#4b2a16" stroke-width="1.800" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.500"/><path d="M7.500 12l3.200 3.400L17 8.500" stroke-linecap="round"/></svg>',
    tests: '<svg viewBox="0 0 24 24" fill="none" stroke="#4b2a16" stroke-width="1.700" stroke-linejoin="round"><path d="M5 2.500h10.500L20 7v14.500H5z"/><path d="M8.500 9h7.500M8.500 12.500h7.500M8.500 16h7.500"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="#4b2a16" stroke-width="1.700" stroke-linejoin="round"><path d="M3 21.500h18M4.500 21.500v-9h4v9M10 21.500V3.500h4v18M15.500 21.500V9.500h4v12"/></svg>',
    staff: '<svg viewBox="0 0 24 24" fill="#4b2a16"><circle cx="12" cy="8" r="4"/><circle cx="4.700" cy="10" r="2.800"/><circle cx="19.300" cy="10" r="2.800"/><path d="M5 21c0-4.500 3-7.500 7-7.500s7 3 7 7.500zM0 19c0-3 1.800-5.200 4.500-5.200.6 0 1.100.1 1.600.3C4.600 15.500 3.800 17.200 3.700 19zM24 19c0-3-1.800-5.200-4.500-5.200-.6 0-1.100.1-1.600.3 1.500 1.400 2.300 3.100 2.400 4.900z"/></svg>'
  };
  var NAV = [['home', 'Overview'], ['lessons', 'Lessons'], ['homework', 'Homework'], ['quizzes', 'Quiz'], ['tests', 'Test'], ['dashboard', 'My progress'], ['staff', 'Staff']];
  var navNow = 'home';
  function renderNav(active) {
    navNow = active;
    var news = state.history.some(function (h) { return h && h.fresh; });
    document.getElementById('nav').innerHTML = NAV.map(function (n) {
      var on = n[0] === active, dot = n[0] === 'dashboard' && news;
      return '<a class="nav-item' + (on ? ' active' : '') + '" href="#' + n[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + ICONS[n[0]] + n[1] + (dot ? '<span class="nav-dot" aria-label="new feedback"></span>' : '') + '</a>';
    }).join('');
    var activeLink = document.querySelector('.nav-item.active');
    var navBox = document.getElementById('nav');
    if (activeLink && activeLink.scrollIntoView && navBox.scrollWidth > navBox.clientWidth) activeLink.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  /* ---------- The tangent explorer ---------- */
  function px(x) { return 320 + x * 130; }
  function py(y) { return 260 - y * 55; }
  function explorer() {
    var d = '';
    for (var x = -2.2; x <= 2.21; x += 0.1) d += (d ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(x * x).toFixed(1);
    return '<svg class="explorer" viewBox="0 0 640 300" role="img" aria-label="Graph of f of x equals x squared with a movable tangent line">' +
      '<line x1="20" y1="260" x2="620" y2="260" class="axis"/><line x1="320" y1="290" x2="320" y2="10" class="axis"/><text x="606" y="284">x</text><text x="330" y="26">y</text>' +
      '<path class="curve" d="' + d + '"/><line class="tangent" data-tangent/><circle class="dot" r="8" data-dot/><text x="450" y="60">f(x) = x²</text></svg>' +
      '<label class="slider-row">Move the point <input type="range" id="explore-x" min="-2" max="2" step="0.1" value="1.1" data-explore></label><div class="readout" data-readout></div>';
  }
  function updateExplorer() {
    var input = view.querySelector('[data-explore]');
    if (!input) return;
    var x = Number(input.value), m = 2 * x, y = x * x;
    var dot = view.querySelector('[data-dot]'), line = view.querySelector('[data-tangent]');
    dot.setAttribute('cx', px(x)); dot.setAttribute('cy', py(y));
    line.setAttribute('x1', px(x - 1)); line.setAttribute('y1', py(y - m));
    line.setAttribute('x2', px(x + 1)); line.setAttribute('y2', py(y + m));
    view.querySelector('[data-readout]').innerHTML = 'x = ' + x.toFixed(1) + '. Instantaneous rate of change: f′(x) = ' + m.toFixed(1);
  }

  /* ---------- Shared content blocks ---------- */
  function topicCards() {
    return '<div class="grid g4">' + TOPIC_ORDER.map(function (id) {
      var t = TOPICS[id];
      return '<a class="paper topic" href="#lessons-' + id + '"><span class="num">0' + t.n + '</span><div class="eyebrow">' + t.tag + '</div><h3>' + t.title + '</h3><div class="big-math">' + tex(t.formula) + '</div><p>' + esc(t.blurb) + '</p><span class="go">Explore lesson ›</span></a>';
    }).join('') + '</div>';
  }
  function teamCards() {
    return '<div class="grid team-grid">' + ['teacher', 'nazhan', 'erin'].map(function (id) {
      var t = TEAM[id], lead = id === 'teacher';
      return '<article class="paper team' + (lead ? ' lead' : '') + '">' + (lead ? '<span class="lead-tag">Lead teacher</span>' : '') + art(t.portrait, '', 'width="124" height="124" loading="lazy"') + '<h3>' + esc(t.name) + '</h3><div class="role">' + esc(t.role) + '</div><p>' + esc(t.line) + '</p><dl>' +
        t.details.map(function (d) { return '<dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd>'; }).join('') + '</dl></article>';
    }).join('') + '</div>';
  }

  /* ---------- Overview ---------- */
  function pageHome() {
    view.innerHTML = hero('CIMP · Calculus &amp; Vectors', 'A little curiosity.<br>A whole new rate of change.', 'Calculus makes the changing world make sense. Explore the ideas, connect the dots, and build your confidence, one derivative at a time.', art('chef-wave', '', 'width="220" height="290"') + art('fries', '', 'width="150" height="190"')) +
      '<div class="row"><a class="btn" href="#lessons">Start learning</a><a class="btn quiet" href="#lessons-product">Begin with the product rule</a></div>' +
      '<p class="hand hero-note" style="color:var(--cream);margin-top:18px">Built for Grade 12. Designed for understanding.</p>' +
      '<section class="section grid g2"><div class="paper clipboard"><div class="eyebrow">The beauty of change · Explore an idea</div><h2>A curve. A point. A new perspective.</h2>' + explorer() + '</div>' +
      '<div class="paper"><h2>The slope tells a story.</h2><p class="eyebrow" style="margin-top:12px">From change to understanding</p><div class="big-math">' + tex("f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}", true) + '</div><p class="hand">Big ideas. Clear, small steps.</p><ul class="ticks"><li><b>4 connected topics.</b> One foundation to build on.</li><li><b>Learn by doing.</b> Practice with purpose.</li><li><b>Understand the why.</b> Go beyond memorizing.</li></ul></div></section>' +
      '<section class="section"><div class="sec-head"><div class="eyebrow">Your learning path</div><h2>It all starts with a good foundation.</h2><p>Four topics. Connected ideas. Explore at your own pace.</p></div>' + topicCards() + '<div class="row"><a class="btn quiet" href="#lessons">View all lessons</a></div></section>' +
      '<section class="section"><div class="sec-head"><div class="eyebrow">A little progress, every day</div><h2>Learn it. Try it. Make it click.</h2><p>Start with the concepts, give yourself room to practice, and reflect on what you understand.</p></div><div class="paper grid g3">' +
      '<a class="ticket" href="#lessons"><span class="fine">01 · Start here</span><b>Explore the lessons</b>Connect formulas with explanations and visuals.</a><a class="ticket" href="#homework"><span class="fine">02</span><b>Put ideas into practice</b>Build confidence with hints and worked solutions.</a><a class="ticket" href="#quizzes"><span class="fine">03</span><b>Check your understanding</b>Explore a quiz and deeper test with feedback.</a></div></section>' +
      '<section class="section"><div class="sec-head"><div class="eyebrow">More than a formula</div><h2>What you’ll take away.</h2><p>A toolkit for solving problems, and the confidence to explain your thinking.</p></div><div class="paper"><ul class="ticks"><li>Differentiate products, quotients, and essential functions.</li><li>Interpret derivatives as instantaneous rates of change.</li><li>Find tangent and normal lines using first principles and derivatives.</li><li>Communicate mathematical reasoning with clarity.</li></ul></div></section>' +
      '<section class="section"><div class="sec-head"><div class="eyebrow">A collaborative CCT project</div><h2>Meet your teacher and student instructors</h2><p>Two student instructors. Four connected calculus topics.</p></div>' + teamCards() + '</section>';
    updateExplorer();
  }

  /* ---------- Lessons ---------- */
  function pageLessonList() {
    view.innerHTML = hero('The learning studio', 'Small steps. Big understanding.', 'Explore the ideas behind differentiation. Start with a topic that sparks your curiosity, or follow the path from beginning to end.', art('fries', '', 'width="150" height="190"')) +
      '<section class="section">' + topicCards() + '</section>' +
      '<section class="section paper"><h2>Learning is a process.</h2><p>Read the idea, explore a visual, then explain it in your own words.</p><div class="row"><a class="btn" href="#lessons-product">Begin with the product rule</a></div></section>';
  }
  function pageLesson(id) {
    var t = TOPICS[id];
    if (!t) { location.hash = '#lessons'; return; }
    var order = TOPIC_ORDER.indexOf(id), prev = TOPIC_ORDER[order - 1], next = TOPIC_ORDER[order + 1];
    var steps = t.steps ? '<div class="row" style="align-items:center"><ol class="nums hand" style="flex:1;min-width:200px">' + t.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' + art('uv', 'A steak labelled u and fries labelled v', 'width="190" height="150" loading="lazy"') + '</div>' : '';
    view.innerHTML = '<div class="row"><a class="btn small quiet" href="#lessons">‹ All lessons</a></div>' +
      hero('Lesson 0' + t.n + ' · ' + t.tag, esc(t.title), esc(t.blurb), art('chef-spatula', '', 'width="150" height="200"')) +
      '<section class="section grid g2"><div class="paper clipboard"><div class="eyebrow">The core idea</div><h2>One formula. A useful connection.</h2><div class="big-math">' + tex(t.formula, true) + '</div><p>' + esc(t.blurb) + ' Use the learning goals to guide what you notice, and take a moment to connect each symbol to its meaning.</p>' + steps + '</div>' +
      videoPanel(id, t) + '</section>' +
      '<section class="section grid g2"><div class="paper"><div class="eyebrow">An illustrative example</div><h2>See the rule in action.</h2><div class="big-math">' + tex(t.example, true) + '</div><ol class="nums"><li>Identify the function and choose the appropriate differentiation rule.</li><li>Differentiate the individual terms or factors.</li><li>Substitute into the rule, simplify, and check your result.</li></ol></div>' +
      '<div class="paper"><div class="eyebrow">Your learning goals</div><h2>What to look for.</h2><ul class="ticks">' + t.goals.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul><div class="pitfall"><b>A common pitfall</b><br>' + esc(t.pitfall) + '</div></div></section>' +
      '<section class="section paper"><div class="eyebrow">Explore the visual</div><h2>A derivative is a slope.</h2><p class="fine" style="margin-bottom:12px">This illustration uses f(x) = x². Move the point and notice how the tangent changes as you travel along the curve.</p>' + explorer() + '</section>' +
      '<section class="section paper"><div class="eyebrow">Practice this topic</div><h2>Ready to practice?</h2><p>Test your understanding of ' + t.title.toLowerCase() + ' with hints, equation entry, and worked solutions.</p><div class="row"><a class="btn quiet" href="#practice-' + id + '">More practice</a><button class="btn quiet" data-act="formulas">Formula sheet</button><a class="btn" href="#homework-' + id + '">Start homework practice</a></div>' +
      '<div class="row split"><span class="fine">Lesson ' + t.n + ' of 4</span><span class="row" style="margin:0">' + (prev ? '<a class="btn small quiet" href="#lessons-' + prev + '">‹ ' + TOPICS[prev].title + '</a>' : '') + (next ? '<a class="btn small quiet" href="#lessons-' + next + '">' + TOPICS[next].title + ' ›</a>' : '<span class="fine">You’ve reached the end</span>') + '</span></div></section>';
    updateExplorer();
  }

  /* ---------- Lesson video ---------- */
  function videoPanel(id, t) {
    return '<div class="video"><div class="video-head"><div><b>Watch the explanation</b><br><small>Presented by ' + esc(t.presenter) + ' · about 5 minutes</small></div></div><div data-screen>' + videoScreen(id) + '</div></div>';
  }
  function videoScreen(id) {
    var v = staffData.videos[id];
    if (v && /^[0-9a-f]{32}$/i.test(v.assetId || '')) return '<div class="screen has-video"><video src="/_blob/' + v.assetId + '" controls playsinline preload="metadata" data-video></video></div>';
    if (v && /^https:\/\//i.test(v.link || '')) return '<div class="screen"><a class="btn" href="' + esc(v.link) + '" target="_blank" rel="noopener">Watch the video ›</a></div>';
    /* Lesson links kept in data.js (VIDEO_LINKS): a Google Drive link plays inside the page. */
    var fixed = typeof VIDEO_LINKS === 'object' && VIDEO_LINKS[id];
    if (fixed && /^https:\/\//i.test(fixed)) {
      var drive = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(fixed);
      return drive ? '<div class="screen has-video"><iframe src="https://drive.google.com/file/d/' + drive[1] + '/preview" allow="autoplay; fullscreen" allowfullscreen title="Lesson video" style="width:100%;aspect-ratio:16/9;border:0;border-radius:10px"></iframe></div><p class="fine" style="text-align:center"><a href="' + esc(fixed) + '" target="_blank" rel="noopener">Video not playing? Open it in a new tab</a></p>' :
        '<div class="screen"><a class="btn" href="' + esc(fixed) + '" target="_blank" rel="noopener">Watch the video ›</a></div>';
    }
    /* GitHub version: a video file uploaded next to index.html plays right here. If there is no file, the note shows. */
    if (STANDALONE && VIDEO_FILES[id]) return '<div class="screen has-video"><video src="' + VIDEO_FILES[id] + '" controls playsinline preload="metadata" data-video data-video-file-local></video></div>';
    return NO_VIDEO;
  }
  var NO_VIDEO = '<div class="screen"><span>The video for this lesson hasn’t been added yet.</span></div>';
  /* The file names to upload to GitHub, one per lesson. */
  var VIDEO_FILES = { product: 'product-rule.mp4', quotient: 'quotient-rule.mp4', derivatives: 'essential-derivatives.mp4', rates: 'rates-of-change.mp4' };
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (el && el.tagName === 'VIDEO' && el.hasAttribute('data-video-file-local')) { var box = el.closest('[data-screen]'); if (box) box.innerHTML = NO_VIDEO; }
  }, true);

  function formula(q) { return q.tex ? '<div class="q-math">' + tex(q.tex, true) + '</div>' : ''; }

  /* ---------- Answer fields, shared by homework, quizzes and tests ---------- */
  var SYMBOLS = [['a/b', '/'], ['x²', '^2'], ['√', '√('], ['( )', '()'], ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['d/dx', 'd/dx ']];
  function fields(q, saved, scope) {
    var a = saved || {}, html = '';
    if (q.kind === 'mc') {
      html += '<div class="mc" role="group" aria-label="Choose your answer">' + q.choices.map(function (c, i) {
        return '<button class="mc-opt' + (a.pick === i ? ' on' : '') + '" data-act="pick" data-scope="' + scope + '" data-pick="' + i + '" aria-pressed="' + (a.pick === i) + '"><span class="coin">' + LETTERS[i] + '</span>' + tex(c) + '</button>';
      }).join('') + '</div>';
    } else if (q.kind !== 'explain') {
      html += '<div class="field-head"><label for="answer-field">Your answer</label></div><div class="symbols">' + SYMBOLS.map(function (s) { return '<button type="button" data-act="symbol" data-insert="' + s[1] + '" aria-label="Insert ' + s[0] + '">' + s[0] + '</button>'; }).join('') + '</div>' +
        '<input id="answer-field" class="math-in" autocomplete="off" spellcheck="false" placeholder="For example 3x^2 + 2x" data-field="answer" data-scope="' + scope + '" value="' + esc(a.answer) + '">';
    } else {
      html += '<div class="field-head"><label for="explain-field">Your explanation</label></div><textarea id="explain-field" class="work" data-field="answer" data-scope="' + scope + '" placeholder="Explain your reasoning here.">' + esc(a.answer) + '</textarea>';
    }
    return html + padHtml(a, scope, q.prompt.length > 200 ? 'Multi-step working and explanation' : 'Your working');
  }
  function hasResponse(a) {
    return !!a && (a.pick !== undefined || !!(a.answer && a.answer.trim()) || !!(a.working && a.working.trim()) || !!(a.sketch && a.sketch.s && a.sketch.s.length));
  }

  /* ---------- Sketch pad: students draw their working with a mouse, finger or stylus ----------
     Strokes are stored as whole numbers on a page 1000 units wide, so they stay small to save
     and redraw sharply at any screen size. The eraser removes whole strokes it touches. */
  var PAD_W = 1000, PAD_H = 600, PAD_MORE = 400, PAD_MAX = 2400, PAD_INK = ['#2a1a10', '#b83a2a'];
  var padTool = 'pen', pad = null, padUndo = {};
  function padHtml(a, scope, label) {
    var sk = a.sketch || {}, h = sk.h || PAD_H, has = sk.s && sk.s.length;
    function tool(t, name) { return '<button type="button" class="pad-btn' + (padTool === t ? ' on' : '') + '" data-act="pad-tool" data-tool="' + t + '" aria-pressed="' + (padTool === t) + '">' + name + '</button>'; }
    return '<div class="field-head"><span id="pad-lbl-' + scope.replace(/\W/g, '-') + '">' + label + '</span><div class="pad-tools" role="toolbar" aria-label="Drawing tools">' +
      tool('pen', '<i class="dot"></i>Pen') + tool('red', '<i class="dot red"></i>Red') + tool('eraser', 'Eraser') +
      '<button type="button" class="pad-btn" data-act="pad-undo" data-scope="' + scope + '">Undo</button><button type="button" class="pad-btn" data-act="pad-clear" data-scope="' + scope + '">Clear</button></div></div>' +
      '<div class="pad' + (has ? ' has' : '') + '" data-pad="' + scope + '" style="aspect-ratio:' + PAD_W + '/' + h + '"><canvas role="img" aria-labelledby="pad-lbl-' + scope.replace(/\W/g, '-') + '"></canvas><p class="pad-empty" aria-hidden="true">Draw your working here with your mouse, finger or stylus</p></div>' +
      '<div class="pad-foot"><span class="fine">Saved as you draw.</span>' + (h < PAD_MAX ? '<button type="button" class="pad-btn" data-act="pad-more" data-scope="' + scope + '">+ More space</button>' : '') + '</div>';
  }
  function sketchFor(scope) { var a = answerFor(scope); return a.sketch || (a.sketch = { h: PAD_H, s: [] }); }
  function padStroke(ctx, st, k) {
    var p = st.p;
    ctx.strokeStyle = ctx.fillStyle = PAD_INK[st.c || 0];
    if (p.length <= 2) { ctx.beginPath(); ctx.arc(p[0] * k, p[1] * k, ctx.lineWidth / 2, 0, 7); ctx.fill(); return; }
    ctx.beginPath(); ctx.moveTo(p[0] * k, p[1] * k);
    for (var i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i] * k, p[i + 1] * k, (p[i] + p[i + 2]) / 2 * k, (p[i + 1] + p[i + 3]) / 2 * k);
    ctx.lineTo(p[p.length - 2] * k, p[p.length - 1] * k);
    ctx.stroke();
  }
  function paintPad(box) {
    var cv = box.querySelector('canvas'), dpr = window.devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight;
    if (!w) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext('2d'), sk = (answerPeek(box.dataset.pad) || {}).sketch, k = cv.width / PAD_W;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = 2.6 * dpr;
    if (sk && sk.s) sk.s.forEach(function (st) { padStroke(ctx, st, k); });
    box.classList.toggle('has', !!(sk && sk.s && sk.s.length));
  }
  /* Reads an answer without creating an empty one. */
  function answerPeek(scope) {
    var p = scope.split(':');
    if (p[0] === 'h') return state.homework[p[1]];
    var live = state.live[p[1]];
    return live && live.answers[p[2]];
  }
  function paintAllPads() { view.querySelectorAll('.pad').forEach(paintPad); }
  new MutationObserver(function () { view.querySelectorAll('.pad:not([data-ready])').forEach(function (b) { b.dataset.ready = '1'; paintPad(b); }); }).observe(view, { childList: true, subtree: true });
  addEventListener('resize', paintAllPads);
  function padPoint(cv, e) {
    var r = cv.getBoundingClientRect(), k = PAD_W / r.width;
    return [Math.round((e.clientX - r.left) * k), Math.round((e.clientY - r.top) * k)];
  }
  function eraseAt(scope, sk, pt) {
    var gone = [];
    for (var i = sk.s.length - 1; i >= 0; i--) {
      var p = sk.s[i].p;
      for (var j = 0; j < p.length; j += 2) if (Math.abs(p[j] - pt[0]) < 16 && Math.abs(p[j + 1] - pt[1]) < 16) { gone.push([i, sk.s.splice(i, 1)[0]]); break; }
    }
    if (gone.length) (padUndo[scope] = padUndo[scope] || []).push({ erased: gone });
    return gone.length;
  }
  function padChanged(scope) {
    save();
    if (scope.charAt(0) === 'h') drawChecks();
    else if (state.live[scope.split(':')[1]]) drawFocusNav(scope.split(':')[1]);
  }
  document.addEventListener('pointerdown', function (e) {
    var cv = e.target.closest && e.target.closest('.pad canvas');
    if (!cv || e.button > 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* still draws without capture */ }
    var box = cv.parentNode, scope = box.dataset.pad, sk = sketchFor(scope), pt = padPoint(cv, e);
    pad = { box: box, scope: scope, sk: sk, id: e.pointerId, changed: false };
    if (padTool === 'eraser') { pad.erase = true; if (eraseAt(scope, sk, pt)) { pad.changed = true; paintPad(box); } return; }
    pad.st = { c: padTool === 'red' ? 1 : 0, p: pt };
    sk.s.push(pad.st);
    pad.changed = true;
    (padUndo[scope] = padUndo[scope] || []).push({ added: pad.st });
    paintPad(box);
  });
  document.addEventListener('pointermove', function (e) {
    if (!pad || e.pointerId !== pad.id) return;
    var cv = pad.box.querySelector('canvas'), list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!list.length) list = [e];
    list.forEach(function (ev) {
      var pt = padPoint(cv, ev);
      if (pad.erase) { if (eraseAt(pad.scope, pad.sk, pt)) pad.changed = true; return; }
      var p = pad.st.p, dx = pt[0] - p[p.length - 2], dy = pt[1] - p[p.length - 1];
      if (dx * dx + dy * dy >= 9) p.push(pt[0], pt[1]);
    });
    paintPad(pad.box);
  });
  function padEnd(e) {
    if (!pad || e.pointerId !== pad.id) return;
    var done = pad;
    pad = null;
    if (done.changed) padChanged(done.scope);
  }
  document.addEventListener('pointerup', padEnd);
  document.addEventListener('pointercancel', padEnd);
  function padAct(act, scope, tool) {
    if (act === 'pad-tool') {
      padTool = tool;
      view.querySelectorAll('[data-act="pad-tool"]').forEach(function (b) { var on = b.dataset.tool === tool; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      return;
    }
    var sk = sketchFor(scope), stack = padUndo[scope] = padUndo[scope] || [], box = view.querySelector('[data-pad="' + scope + '"]');
    if (act === 'pad-undo') {
      var op = stack.pop();
      if (!op) { toast('Nothing to undo.'); return; }
      if (op.added) { var at = sk.s.lastIndexOf(op.added); if (at !== -1) sk.s.splice(at, 1); }
      if (op.erased) op.erased.slice().reverse().forEach(function (g) { sk.s.splice(g[0], 0, g[1]); });
      if (op.cleared) sk.s = op.cleared;
    } else if (act === 'pad-clear') {
      if (!sk.s.length) return;
      stack.push({ cleared: sk.s });
      sk.s = [];
      toast('Cleared. Press Undo to bring it back.');
    } else if (act === 'pad-more') {
      sk.h = Math.min(PAD_MAX, (sk.h || PAD_H) + PAD_MORE);
      if (box) box.style.aspectRatio = PAD_W + '/' + sk.h;
      if (sk.h >= PAD_MAX && box) { var more = box.nextElementSibling.querySelector('[data-act="pad-more"]'); if (more) more.remove(); }
    }
    if (box) paintPad(box);
    padChanged(scope);
  }
  /* The drawing as a picture, for the results page. */
  function sketchSvg(sk) {
    if (!sk || !sk.s || !sk.s.length) return '';
    var maxY = 0;
    var strokes = sk.s.filter(function (st) { return st && Array.isArray(st.p) && st.p.length >= 2; }).map(function (st) {
      return { c: st.c === 1 ? 1 : 0, p: st.p.map(function (v) { return Math.round(Number(v)) || 0; }) };
    });
    if (!strokes.length) return '';
    strokes.forEach(function (st) { for (var j = 1; j < st.p.length; j += 2) maxY = Math.max(maxY, st.p[j]); });
    var h = Math.max(120, Math.min(Number(sk.h) || PAD_H, PAD_MAX, maxY + 40));
    return '<svg class="sketch-view" viewBox="0 0 ' + PAD_W + ' ' + h + '" role="img" aria-label="Drawn working">' + strokes.map(function (st) {
      var p = st.p, c = PAD_INK[st.c || 0];
      if (p.length <= 2) return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="' + c + '"/>';
      var d = 'M' + p[0] + ' ' + p[1];
      for (var i = 2; i < p.length; i += 2) d += 'L' + p[i] + ' ' + p[i + 1];
      return '<path d="' + d + '" stroke="' + c + '"/>';
    }).join('') + '</svg>';
  }
  /* Saved answers live under a "scope": h:demo1 for homework, or a:quiz1:0 for an assessment question. */
  function answerFor(scope) {
    var p = scope.split(':');
    if (p[0] === 'h') return state.homework[p[1]] || (state.homework[p[1]] = {});
    var live = state.live[p[1]];
    return live.answers[p[2]] || (live.answers[p[2]] = {});
  }

  /* ---------- Homework ---------- */
  var HW_TABS = [['all', 'All topics'], ['product', 'Product rule'], ['quotient', 'Quotient rule'], ['derivatives', 'Essential derivatives'], ['rates', 'Rates of change']];
  var hw = { topic: 'all', id: null, hints: 0, solution: false, result: null };
  function homeworkFor(topic) { return COURSE.homework.filter(function (q) { return topic === 'all' || q.topic === topic; }); }
  function pageHomework(topic) {
    topic = topic || 'all';
    if (topic !== 'all' && !TOPICS[topic]) { location.hash = '#homework'; return; }
    var list = homeworkFor(topic);
    hw = { topic: topic, id: list[0].id, hints: 0, solution: false, result: null };
    view.innerHTML = hero('Practice with purpose', 'Homework', 'Practice with hints and worked solutions, at your own pace. Homework is ungraded, and your answers save automatically.', art('chef-spatula', '', 'width="150" height="200"')) +
      '<div class="chips section" role="navigation" aria-label="Choose a topic">' + HW_TABS.map(function (t) { return '<a class="chip' + (t[0] === topic ? ' on' : '') + '" href="#homework-' + t[0] + '"' + (t[0] === topic ? ' aria-current="true"' : '') + '>' + t[1] + '</a>'; }).join('') + '</div>' +
      '<div class="row"><a class="btn small" href="#practice-' + (topic === 'all' ? 'product' : topic) + '">More practice with new numbers</a><button class="btn small quiet" data-act="formulas">Formula sheet</button></div>' +
      '<div class="rail"></div><div class="checks" data-checks></div><section class="section paper clipboard" id="question" data-panel></section>' +
      '<div class="row"><button class="btn small quiet" data-act="hw-reset">Reset attempt</button></div>';
    drawChecks();
    drawHomeworkPanel();
  }
  function drawChecks() {
    var holder = view.querySelector('[data-checks]');
    if (!holder) return;
    holder.innerHTML = homeworkFor(hw.topic).map(function (q) {
      var done = hasResponse(state.homework[q.id]);
      return '<button class="check' + (q.id === hw.id ? ' on' : '') + '" data-act="hw" data-id="' + q.id + '" aria-pressed="' + (q.id === hw.id) + '"><h3>Question ' + (COURSE.homework.indexOf(q) + 1) + '</h3><div class="small-math">' + tex(q.tex.replace(/^f\(x\)=/, '')) + '</div><small>' + esc(TOPICS[q.topic].title) + '</small>' + (done ? '<small class="saved">✓ Response saved</small>' : '') + '</button>';
    }).join('');
  }
  function drawHomeworkPanel() {
    var panel = view.querySelector('[data-panel]');
    var list = homeworkFor(hw.topic), index = list.findIndex(function (q) { return q.id === hw.id; }), q = list[index];
    var result = hw.result ? '<div class="note ' + hw.result[0] + '" role="status">' + hw.result[1] + '</div>' : '';
    panel.innerHTML = katc(q) + '<div class="q-meta"><span>Question ' + (index + 1) + ' of ' + list.length + ' · ' + esc(TOPICS[q.topic].title) + '</span>' + (q.staff ? '' : '<span class="tag">Demonstration question</span>') + '</div>' +
      '<h2 class="q-title q-ask">' + esc(q.prompt || q.title) + '</h2>' + formula(q) + fields(q, state.homework[q.id], 'h:' + q.id) + result +
      '<div class="row">' + (q.kind === 'expr' ? '<button class="btn small" data-act="hw-check">Check answer</button>' : '') +
      (hw.hints < q.hints.length ? '<button class="btn small quiet" data-act="hw-hint">Show hint ' + (hw.hints + 1) + '</button>' : '') +
      '<button class="btn small quiet" data-act="hw-solution">' + (hw.solution ? 'Hide solution' : 'Show solution') + '</button></div>' +
      q.hints.slice(0, hw.hints).map(function (h, i) { return '<div class="note"><b>Hint ' + (i + 1) + ':</b> ' + rich(h) + '</div>'; }).join('') +
      (hw.solution ? '<div class="note"><b>Worked solution</b><br>' + q.solution.map(rich).join('<br>') + '</div>' : '') +
      '<div class="row split"><button class="btn small quiet" data-act="hw-go" data-to="' + (index - 1) + '"' + (index === 0 ? ' disabled' : '') + '>‹ Previous question</button><button class="btn small quiet" data-act="hw-go" data-to="' + (index + 1) + '"' + (index === list.length - 1 ? ' disabled' : '') + '>Next question ›</button></div>';
  }
  function selectHomework(id, reveal) {
    hw.id = id; hw.hints = 0; hw.solution = false; hw.result = null;
    drawChecks(); drawHomeworkPanel();
    if (reveal) {
      var panel = view.querySelector('[data-panel]');
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  /* ---------- Quiz and test menus ---------- */
  function latest(key) { var runs = state.history.filter(function (h) { return h.key === key; }); return runs[runs.length - 1]; }
  /* A question is worth 1 to 10 marks. run.marks holds the share each answer earned: 1 full, 0 none,
     anything between for part marks, null while it waits for the teacher. */
  function qValue(q) { return Math.max(1, Math.min(10, Math.round(Number(q && q.marks)) || 1)); }
  function halves(n) { return Math.round(n * 2) / 2; }
  function fmtMarks(n) { n = halves(n); var whole = Math.floor(n); return n === whole ? String(n) : (whole ? whole : '') + '½'; }
  function runScore(run) { var list = runQuestions(run); return halves(run.marks.reduce(function (sum, m, i) { return sum + (Number(m) || 0) * qValue(list[i]); }, 0)); }
  function runTotal(run) { var list = runQuestions(run); return run.marks.reduce(function (sum, _, i) { return sum + qValue(list[i]); }, 0); }
  function scoreText(run) { return fmtMarks(runScore(run)) + '/' + runTotal(run); }
  function pagePicker(kind) {
    var items = COURSE[kind], word = kind === 'quizzes' ? 'Quiz' : 'Test';
    view.innerHTML = hero('Checkpoint · ' + (kind === 'quizzes' ? 'Assessment 1' : 'Assessment 2'), kind === 'quizzes' ? 'Assessment 1: Quiz' : 'Assessment 2: Test', kind === 'quizzes' ? 'Check your foundations with mathematical answers, explanations, and saved working.' : 'Connect calculus ideas through multi-step working and mathematical reasoning.', art('steak', '', 'width="170" height="150"')) +
      '<p class="page-note" style="color:var(--cream);margin-top:16px">Select a section below. Each ' + word.toLowerCase() + ' is scored independently and has its own saved progress.</p><section class="section grid g2">' +
      Object.keys(items).map(function (id, i) {
        var item = items[id], last = latest(id);
        return '<article class="paper clipboard"><div class="eyebrow">' + item.part + ' · Instructor: ' + esc(item.instructor) + '</div><h2>' + esc(item.title) + '</h2><ul class="covers">' + item.covers.map(function (c) { return '<li>' + rich(c) + '</li>'; }).join('') + '</ul>' +
          '<p class="fine">' + plannedCount(id) + ' questions · ' + item.minutes + ' minutes · ' + (last ? 'Last score ' + scoreText(last) : 'Independent progress') + (attemptLimit(id) ? ' · ' + attemptsUsed(id) + ' of ' + attemptLimit(id) + ' attempt' + (attemptLimit(id) === 1 ? '' : 's') + ' used' : '') + '</p><div class="row">' +
          (!state.live[id] && attemptsLeft(id) <= 0 ? '<span class="closed-tag">No attempts left</span>' + (last ? '<a class="btn small quiet" href="#results-' + state.history.indexOf(last) + '">See your results</a>' : '') :
          isOpen(id) || state.live[id] ? '<a class="btn" href="#' + kind + '-' + id + '">' + (state.live[id] ? 'Resume ' : 'Start ') + word + ' ' + (i + 1) + '</a>' : '<span class="closed-tag">Closed by your teacher</span>') + '</div></article>';
      }).join('') + '</section>';
  }

  /* ---------- Taking a quiz or test ---------- */
  var ticker = null;
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }
  function defOf(id) { return COURSE.quizzes[id] || COURSE.tests[id]; }
  /* An attempt keeps its own copy of the questions, so staff edits can't disturb it. */
  function qs(id) { return (state.live[id] && state.live[id].questions) || defOf(id).questions; }
  function runQuestions(run) { return run.questions || defOf(run.key).questions; }
  function isQuiz(id) { return !!COURSE.quizzes[id]; }
  function kindOf(id) { return isQuiz(id) ? 'quizzes' : 'tests'; }
  function calmMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  /* A new attempt opens with the order ticket. A running one goes straight back into focus mode. */
  async function pageAssessment(id) {
    var def = defOf(id), token = routeToken;
    if (!def) { location.hash = '#home'; return; }
    if (state.live[id]) { drawFocus(id, false); return; }
    /* The menu stays behind the ticket, so "Not yet" is just a step back. */
    pagePicker(kindOf(id));
    /* The ticket counts the questions, so it waits for staff questions and controls first. */
    await staff.firstData;
    var askName = await canShareScores();
    if (token !== routeToken) return;
    if (!isOpen(id)) {
      view.innerHTML = '<section class="section paper"><h2>' + esc(def.title) + ' is closed</h2><p>Your teacher hasn’t opened this one yet. Check back later.</p><div class="row"><a class="btn small quiet" href="#' + kindOf(id) + '">Back</a></div></section>';
      return;
    }
    if (attemptsLeft(id) <= 0) {
      view.innerHTML = '<section class="section paper"><h2>No attempts left for ' + esc(def.title.split(':')[0]) + '</h2><p>Your teacher allows ' + attemptLimit(id) + ' attempt' + (attemptLimit(id) === 1 ? '' : 's') + ', and you have used ' + (attemptLimit(id) === 1 ? 'it' : 'them all') + '.</p><div class="row"><a class="btn small quiet" href="#' + kindOf(id) + '">Back</a><a class="btn small quiet" href="#dashboard">My progress</a></div></section>';
      return;
    }
    openTicket(id, askName);
  }

  /* ---------- The order ticket: the chef throws a steak, the ticket holds the rules ----------
     First attempt: the full throw. Retake: the steak just drops onto the plate. Reduced motion: no movement. */
  var FLYING_STEAK = '<svg viewBox="0 0 310 152" aria-hidden="true"><defs><linearGradient id="flyc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a3117"/><stop offset=".16" stop-color="#c16f64"/><stop offset=".5" stop-color="#de847e"/><stop offset=".84" stop-color="#c16f64"/><stop offset="1" stop-color="#6a3117"/></linearGradient><radialGradient id="flyt" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#7c4a33"/><stop offset="1" stop-color="#6a3117"/></radialGradient><clipPath id="flyk"><path d="M24 62C26 34 70 20 112 22C140 10 196 8 236 20C274 30 292 52 284 76C278 98 240 104 196 102C160 110 108 108 72 100C38 94 20 84 24 62Z"/></clipPath></defs><ellipse cx="156" cy="142" rx="132" ry="8" fill="#3d1c0b" opacity=".25"/><path d="M284 76C278 98 240 104 196 102C160 110 108 108 72 100C38 94 20 84 24 62L24 92C20 114 38 124 72 130C108 138 160 140 196 132C240 134 278 128 284 106Z" fill="url(#flyc)" stroke="#3e1c05" stroke-width="3" stroke-linejoin="round"/><path d="M236 50C262 60 276 84 270 112" stroke="#f6e3c4" stroke-width="6" fill="none" opacity=".75" stroke-linecap="round"/><path d="M24 62C26 34 70 20 112 22C140 10 196 8 236 20C274 30 292 52 284 76C278 98 240 104 196 102C160 110 108 108 72 100C38 94 20 84 24 62Z" fill="url(#flyt)"/><g clip-path="url(#flyk)"><path d="M58 52c22-10 40 6 62-4s38-8 52 2M100 82c18-8 30 4 48-3s30-6 44 4M190 46c14-6 24 2 38-2" stroke="#fbe9df" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.43"/><g opacity="0.72"><path d="M70 8l-42 104" stroke="#2a1006" stroke-width="7" stroke-linecap="round"/><path d="M115 8l-42 104" stroke="#2a1006" stroke-width="7" stroke-linecap="round"/><path d="M160 8l-42 104" stroke="#2a1006" stroke-width="7" stroke-linecap="round"/><path d="M205 8l-42 104" stroke="#2a1006" stroke-width="7" stroke-linecap="round"/><path d="M250 8l-42 104" stroke="#2a1006" stroke-width="7" stroke-linecap="round"/></g><path d="M112 22C140 10 196 8 236 20C274 30 292 52 284 76" stroke="#bf9d80" stroke-width="13" fill="none"/></g><path d="M24 62C26 34 70 20 112 22C140 10 196 8 236 20C274 30 292 52 284 76C278 98 240 104 196 102C160 110 108 108 72 100C38 94 20 84 24 62Z" fill="none" stroke="#3e1c05" stroke-width="3"/><path d="M60 40C84 30 104 30 124 32" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.17" stroke-linecap="round"/></svg>';
  var intro = { el: null, id: null, token: 0, anims: [], busy: false, throwing: false, askName: false };
  new Image().src = SPRITES + 'chef-spatula.webp';
  function iq(sel) { return intro.el.querySelector(sel); }
  function buildIntro() {
    var el = document.createElement('div');
    el.id = 'intro';
    el.hidden = true;
    el.innerHTML = '<div class="in-dim"></div><div class="in-rail" aria-hidden="true"></div>' +
      '<div class="in-pop" aria-hidden="true"><img class="in-chef" src="' + SPRITES + 'chef-spatula.webp" alt="" width="372" height="420"></div>' +
      '<div class="in-wrap"><form class="order-ticket" data-form="ticket" role="dialog" aria-modal="true" aria-labelledby="tk-title" novalidate></form></div>' +
      '<div class="in-steak" aria-hidden="true">' + FLYING_STEAK + '</div><div class="in-hint" aria-hidden="true">Click anywhere to skip</div>';
    document.body.appendChild(el);
    intro.el = el;
    iq('.in-wrap').addEventListener('scroll', function () { if (!intro.busy && !intro.throwing) placeSteak(); });
  }
  function ticketHtml(id, askName) {
    var def = defOf(id), n = plannedCount(id), p = state.profile || { name: '', cls: '' };
    return '<div class="dish" aria-hidden="true"><div class="plate"></div><div class="slot"></div></div><div class="stamp" aria-hidden="true">ORDER UP!</div>' +
      '<div class="order"><span>Order ticket</span><span>Table: ' + esc(def.title.split(':')[0]) + '</span></div>' +
      '<h1 id="tk-title">' + esc(def.title) + '</h1><p class="who">Presented by ' + esc(def.instructor) + '</p>' +
      '<ul class="rules"><li>' + n + ' question' + (n === 1 ? '' : 's') + ' · ' + def.minutes + ' minutes</li><li>The timer starts when you press Ready</li><li>Your answers save as you go</li><li>You can’t change answers after you submit</li>' + (attemptLimit(id) ? '<li>This is attempt ' + (attemptsUsed(id) + 1) + ' of ' + attemptLimit(id) + '</li>' : '') + '<li>' +
      (answersHidden(id) ? 'Your teacher will share the answers later' : 'You’ll see the answers after you submit') + '</li></ul>' +
      (askName ? '<div class="tk-fields"><label>Your name <small>(required)</small><input id="tk-name" maxlength="60" autocomplete="name" required aria-required="true" value="' + esc(p.name) + '"></label><label>Class <small>(required)</small><input id="tk-class" maxlength="30" placeholder="12A" required aria-required="true" value="' + esc(p.cls) + '"></label></div>' : '') +
      '<div class="row"><button class="btn" type="submit">Ready to cook</button><a class="btn quiet" href="#' + kindOf(id) + '">Not yet</a></div>' +
      '<p class="form-msg" data-tk-msg role="status">' + (askName ? (state.profile ? 'Name and class are filled in from last time. Edit them if they’re wrong.' : 'Add your name and class so your teacher can mark your work. Other students don’t see them.') : '') + '</p>';
  }
  function iplay(el, frames, opts) { var a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts)); intro.anims.push(a); return a.finished.catch(function () {}); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /* Where the steak sits: on the plate above the ticket. */
  function landing() {
    var s = iq('.slot').getBoundingClientRect(), w = iq('.in-steak').offsetWidth;
    return { x: s.left + s.width / 2 - innerWidth / 2, y: s.top + s.height / 2 - innerHeight / 2, s: s.width / w };
  }
  function placeSteak() {
    if (!intro.id) return;
    var steak = iq('.in-steak'), end = landing(), at = 'translate(' + end.x + 'px,' + end.y + 'px) scale(' + end.s + ')';
    steak.getAnimations().forEach(function (a) { a.cancel(); });
    iplay(steak, [{ opacity: 1, transform: at }, { opacity: 1, transform: at }], { duration: 1 });
  }
  function hideIntro() {
    intro.token++;
    intro.anims.forEach(function (a) { a.cancel(); });
    intro.anims = [];
    intro.id = null; intro.busy = false; intro.throwing = false;
    if (intro.el) intro.el.hidden = true;
  }
  function showTicketCard(t) {
    var ticket = iq('.order-ticket');
    intro.ticketUp = true;
    var done = iplay(ticket, [{ opacity: 0, transform: 'translateY(70px) rotate(-2deg)' }, { opacity: 1, transform: 'translateY(-6px) rotate(.5deg)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.3,1)' });
    iplay(iq('.plate'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260 });
    return done.then(function () { if (t === intro.token) focusTicket(); });
  }
  function focusTicket() { var f = iq('#tk-name') || iq('[type="submit"]'); if (f) f.focus({ preventScroll: true }); }
  function openTicket(id, askName) {
    if (!intro.el) buildIntro();
    hideIntro();
    intro.id = id; intro.askName = askName;
    iq('.order-ticket').innerHTML = ticketHtml(id, askName);
    /* The last "Order up" leaves the ticket's final look written on it. Clear that, or it shows before the throw. */
    iq('.order-ticket').removeAttribute('style');
    intro.ticketUp = false;
    intro.el.hidden = false;
    iq('.in-wrap').scrollTop = 0;
    if (calmMotion()) calmTicket();
    else throwSteak();
  }
  function calmTicket() {
    var t = intro.token;
    intro.anims.forEach(function (a) { a.cancel(); });
    intro.anims = []; intro.throwing = false;
    iplay(iq('.in-dim'), [{ opacity: 1 }, { opacity: 1 }], { duration: 1 });
    iplay(iq('.plate'), [{ opacity: 1 }, { opacity: 1 }], { duration: 1 });
    placeSteak();
    iplay(iq('.order-ticket'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    if (t === intro.token) focusTicket();
  }
  /* The chef jumps out from behind the clipboard that was pressed, throws the steak at the screen,
     and only then does the ticket pop up with the steak landing on its plate. */
  function chefSpot() {
    var link = intro.id && view.querySelector('a[href="#' + kindOf(intro.id) + '-' + intro.id + '"]');
    var card = link && link.closest('.clipboard'), r = card && card.getBoundingClientRect();
    var w = Math.max(130, Math.min(230, innerWidth * .22)), h = w * 420 / 372;
    /* The clipboard's top edge, if it is on screen with room above it. Otherwise the bottom of the screen. */
    if (r && r.top > h * .7 && r.top < innerHeight - 60) return { x: r.left + r.width / 2, edge: r.top + 8, w: w, h: h };
    return { x: innerWidth / 2, edge: innerHeight, w: w, h: h };
  }
  async function throwSteak() {
    var t = intro.token, pop = iq('.in-pop'), chef = iq('.in-chef'), steak = iq('.in-steak');
    intro.throwing = true;
    /* The picture has to be loaded, or the steak would fly with no chef. */
    try { await Promise.race([chef.decode(), wait(700)]); } catch (e) { /* throw anyway */ }
    if (t !== intro.token || !intro.throwing) return;
    var c = chefSpot(), hidden = 'translateY(' + c.h * 1.08 + 'px)', up = 'translateY(' + c.h * .16 + 'px)';
    pop.style.left = c.x - c.w + 'px'; pop.style.width = c.w * 2 + 'px';
    pop.style.top = c.edge - c.h * 1.3 + 'px'; pop.style.height = c.h * 1.3 + 'px';
    chef.style.width = c.w + 'px'; chef.style.marginLeft = -c.w / 2 + 'px';
    iplay(iq('.in-hint'), [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: 2200 });
    /* 1. Jump out. */
    await iplay(chef, [{ transform: hidden }, { transform: 'translateY(' + -c.h * .06 + 'px)', offset: .62 }, { transform: up }], { duration: 440, easing: 'cubic-bezier(.2,.9,.3,1)' });
    if (t !== intro.token || !intro.throwing) return;
    /* 2. Wind up, then throw. */
    iplay(chef, [{ transform: up + ' rotate(0)' }, { transform: up + ' rotate(-16deg)', offset: .45 }, { transform: up + ' rotate(12deg)', offset: .75 }, { transform: up + ' rotate(0)' }], { duration: 420 });
    await wait(270);
    if (t !== intro.token || !intro.throwing) return;
    iplay(iq('.in-dim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    var sx = c.x + c.w * .28 - innerWidth / 2, sy = c.edge - c.h * .86 - innerHeight / 2, big = Math.min(innerWidth / 240 * 1.05, 4.6);
    await iplay(steak, [
      { opacity: 1, transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.2) rotate(0)' },
      { opacity: 1, transform: 'translate(' + sx * .45 + 'px,' + (sy * .4 - innerHeight * .16) + 'px) scale(.9) rotate(380deg)', offset: .5 },
      { opacity: 1, transform: 'translate(0,0) scale(' + big + ') rotate(720deg)' }
    ], { duration: 720, easing: 'cubic-bezier(.45,.05,.75,.6)' });
    if (t !== intro.token || !intro.throwing) return;
    /* 3. It hits the screen: squash, the kitchen shakes, and the chef ducks back behind the clipboard. */
    iplay(document.querySelector('.backdrop'), [{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }], { duration: 260, fill: 'none' });
    iplay(chef, [{ transform: up }, { transform: hidden }], { duration: 300, easing: 'ease-in' });
    await iplay(steak, [
      { opacity: 1, transform: 'translate(0,0) scale(' + big + ') rotate(720deg)' },
      { opacity: 1, transform: 'translate(0,0) scale(' + big * 1.1 + ',' + big * .82 + ') rotate(720deg)', offset: .5 },
      { opacity: 1, transform: 'translate(0,0) scale(' + big + ') rotate(720deg)' }
    ], { duration: 220, easing: 'ease-out' });
    if (t !== intro.token || !intro.throwing) return;
    await wait(120);
    if (t !== intro.token || !intro.throwing) return;
    /* 4. Now the ticket pops up, and the steak drops onto its plate. */
    var end = landing();
    showTicketCard(t);
    await iplay(steak, [
      { opacity: 1, transform: 'translate(0,0) scale(' + big + ') rotate(720deg)' },
      { opacity: 1, transform: 'translate(' + end.x + 'px,' + (end.y - 30) + 'px) scale(' + end.s * 1.05 + ') rotate(726deg)', offset: .75 },
      { opacity: 1, transform: 'translate(' + end.x + 'px,' + end.y + 'px) scale(' + end.s + ') rotate(720deg)' }
    ], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' });
    if (t === intro.token) intro.throwing = false;
  }
  /* Ready: check the name, start the timer, stamp the order, pin it on the rail and open focus mode. */
  async function orderUp() {
    if (!intro.id || intro.busy) return;
    var id = intro.id, msg = iq('[data-tk-msg]');
    if (intro.askName) {
      var nm = iq('#tk-name').value.trim(), cl = iq('#tk-class').value.trim();
      if (!nm || !cl) { msg.textContent = 'Add your name and class first.'; msg.classList.add('bad'); (nm ? iq('#tk-class') : iq('#tk-name')).focus(); return; }
      if (!state.profile || state.profile.name !== nm || state.profile.cls !== cl) { state.profile = { name: nm, cls: cl }; delete state.sentSig; scoreStatus = 'idle'; }
    }
    if (!isOpen(id)) { msg.textContent = 'Your teacher has just closed this one.'; msg.classList.add('bad'); return; }
    if (attemptsLeft(id) <= 0) { msg.textContent = 'You have no attempts left for this one.'; msg.classList.add('bad'); return; }
    if (intro.throwing) calmTicket();
    intro.busy = true;
    msg.textContent = '';
    var def = defOf(id), t = intro.token;
    state.live[id] = { answers: {}, current: 0, questions: pickQuestions(id), deadline: Date.now() + def.minutes * 60000 };
    save();
    if (calmMotion()) { hideIntro(); drawFocus(id, true); return; }
    var ticket = iq('.order-ticket'), steak = iq('.in-steak'), rail = iq('.in-rail');
    /* 1. Stamp */
    await iplay(iq('.stamp'), [{ opacity: 0, transform: 'rotate(-12deg) scale(2.4)' }, { opacity: 1, transform: 'rotate(-12deg) scale(.92)', offset: .7 }, { opacity: 1, transform: 'rotate(-12deg) scale(1)' }], { duration: 260, easing: 'cubic-bezier(.3,.6,.4,1)' });
    if (t !== intro.token) return;
    ticket.getAnimations().forEach(function (a) { if (a.commitStyles) a.commitStyles(); a.cancel(); });
    iplay(ticket, [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: 'translate(-3px,2px)' }, { opacity: 1, transform: 'translate(2px,-1px)' }, { opacity: 1, transform: 'none' }], { duration: 160 });
    await wait(260);
    if (t !== intro.token) return;
    /* 2. The rail drops in, the steak slides off, the ticket flies up and pins. */
    iplay(rail, [{ transform: 'translateY(-40px)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
    var at = getComputedStyle(steak).transform;
    steak.getAnimations().forEach(function (a) { a.cancel(); });
    iplay(steak, [{ opacity: 1, transform: at }, { opacity: 0, transform: at + ' translate(' + innerWidth * .6 + 'px, 0) rotate(25deg)' }], { duration: 420, easing: 'cubic-bezier(.5,0,.8,.5)' });
    iplay(iq('.plate'), [{ opacity: 1 }, { opacity: 0, transform: 'translateX(' + innerWidth * .5 + 'px)' }], { duration: 420, easing: 'cubic-bezier(.5,0,.8,.5)' });
    var r = ticket.getBoundingClientRect(), rl = rail.getBoundingClientRect(), k = Math.min(.42, 150 / r.width);
    var dx = rl.left + rl.width / 2 - (r.left + r.width / 2), dy = 30 + r.height * k / 2 - (r.top + r.height / 2);
    function pinned(deg, lift) { return 'translate(' + dx + 'px,' + (dy - (lift || 0)) + 'px) scale(' + k + ') rotate(' + deg + 'deg)'; }
    ticket.getAnimations().forEach(function (a) { a.cancel(); });
    await iplay(ticket, [
      { opacity: 1, transform: 'none' },
      { opacity: 1, transform: 'translate(' + dx * .6 + 'px,' + (dy * .6 - 20) + 'px) scale(' + (k + .2) + ') rotate(-6deg)', offset: .6 },
      { opacity: 1, transform: pinned(-3) }
    ], { duration: 520, easing: 'cubic-bezier(.3,.6,.4,1)' });
    if (t !== intro.token) return;
    iplay(ticket, [{ opacity: 1, transform: pinned(-3) }, { opacity: 1, transform: pinned(2) }, { opacity: 1, transform: pinned(-1) }], { duration: 300 });
    await wait(420);
    if (t !== intro.token) return;
    /* 3. The kitchen clears and the quiz is there, timer running. */
    drawFocus(id, true);
    iplay(iq('.in-dim'), [{ opacity: 1 }, { opacity: 0 }], { duration: 380 });
    iplay(rail, [{ transform: 'translateY(0)' }, { transform: 'translateY(-60px)' }], { duration: 320, delay: 120, easing: 'ease-in' });
    await iplay(ticket, [{ opacity: 1, transform: pinned(-1) }, { opacity: 0, transform: pinned(-1, 260) }], { duration: 380, delay: 120, easing: 'ease-in' });
    if (t === intro.token) hideIntro();
  }
  /* Clicking during the throw skips straight to the ticket. */
  document.addEventListener('click', function (e) {
    if (!intro.el || intro.el.hidden || !intro.throwing || intro.busy) return;
    /* Once the ticket is up, clicks on it are for its fields. Before that it is invisible, so any click skips. */
    if (intro.ticketUp && e.target.closest('.order-ticket')) return;
    calmTicket();
  });
  addEventListener('resize', function () { if (intro.el && !intro.el.hidden && !intro.busy) { if (intro.throwing) calmTicket(); else placeSteak(); } });

  /* ---------- Focus mode: no menu, just the timer, the question and the way to submit ---------- */
  function drawFocus(id, fresh) {
    var def = defOf(id);
    document.documentElement.classList.add('focusing');
    view.innerHTML = '<div class="focus">' +
      '<header class="fbar"><div class="ftitle">' + esc(def.title) + '</div><div class="fmid"><span data-fcount></span><span class="fclock" role="timer" data-fclock>--:--</span></div></header>' +
      '<div class="fmain"><div class="fleft"><section class="paper fcard" data-question></section><div class="factions" data-factions></div></div>' +
      '<aside class="fside" aria-label="Question list"><h2>Questions</h2><nav class="frow" data-frow aria-label="Questions"></nav><p class="fdone" data-fdone></p><div data-fsubmit></div></aside></div></div>';
    drawQuestion(id); drawFocusNav(id);
    stopTicker();
    ticker = setInterval(function () { tick(id); }, 1000);
    tick(id);
    if (fresh) {
      if (!calmMotion()) view.querySelector('.focus').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380 });
      setTimeout(function () { if (state.live[id]) toast('Timer started: ' + clock(def.minutes * 60) + '. Good luck, chef!'); }, calmMotion() ? 0 : 420);
    } else {
      toast('Welcome back. Your timer kept running: ' + clock(secondsLeft(id)) + ' left.');
    }
  }
  function drawQuestion(id) {
    var live = state.live[id], list = qs(id), q = list[live.current], total = list.length;
    view.querySelector('[data-fcount]').textContent = 'Question ' + (live.current + 1) + ' of ' + total;
    view.querySelector('[data-question]').innerHTML = katc(q) + '<div class="q-meta"><span>' + qValue(q) + ' mark' + (qValue(q) === 1 ? '' : 's') + ' · ' + TOPICS[q.topic].title + '</span>' + (q.staff ? '' : '<span class="tag">Demonstration question</span>') + '</div>' +
      '<h2 class="q-title q-ask" tabindex="-1">' + esc(q.prompt || q.title) + '</h2>' + formula(q) + fields(q, live.answers[live.current], 'a:' + id + ':' + live.current);
  }
  function drawFocusNav(id) {
    var live = state.live[id], list = qs(id), last = list.length - 1, row = view.querySelector('[data-frow]');
    /* A late redraw after leaving the quiz has nothing to draw. */
    if (!live || !row) return;
    row.innerHTML = list.map(function (_, i) {
      var done = hasResponse(live.answers[i]);
      return '<button class="fnum' + (done ? ' done' : '') + '" data-act="go" data-id="' + id + '" data-to="' + i + '" aria-label="Question ' + (i + 1) + (done ? ', answered' : '') + '"' + (i === live.current ? ' aria-current="step"' : '') + '>' + (i + 1) + '</button>';
    }).join('');
    view.querySelector('[data-factions]').innerHTML = '<button class="btn quiet" data-act="go" data-id="' + id + '" data-to="' + (live.current - 1) + '"' + (live.current === 0 ? ' disabled' : '') + '>‹ Previous</button><span class="gap"></span>' +
      '<button class="btn quiet" data-act="go" data-id="' + id + '" data-to="' + (live.current + 1) + '"' + (live.current === last ? ' disabled' : '') + '>Next ›</button>';
    var answered = list.filter(function (_, i) { return hasResponse(live.answers[i]); }).length;
    view.querySelector('[data-fdone]').textContent = answered + ' of ' + list.length + ' answered';
    var sub = view.querySelector('[data-fsubmit]');
    if (!sub.firstChild) sub.innerHTML = '<button class="btn" data-act="submit" data-id="' + id + '">Review &amp; submit</button>';
  }
  function secondsLeft(id) { return Math.max(0, Math.ceil((state.live[id].deadline - Date.now()) / 1000)); }
  function tick(id) {
    if (!state.live[id]) return;
    var left = secondsLeft(id), c = view.querySelector('[data-fclock]');
    if (c) {
      c.textContent = clock(left);
      c.classList.toggle('low', left <= 60);
      c.setAttribute('aria-label', 'Time left: ' + Math.floor(left / 60) + ' minutes ' + left % 60 + ' seconds');
    }
    if (left <= 0) { toast('Time’s up! Your answers went to the kitchen.'); finishAssessment(id); }
  }
  function answeredCount(id) {
    var live = state.live[id];
    return qs(id).filter(function (_, i) { return hasResponse(live.answers[i]); }).length;
  }
  function confirmSubmit(id) {
    var blank = qs(id).length - answeredCount(id);
    dialog('Review &amp; submit', (blank ? 'You still have ' + blank + ' question' + (blank === 1 ? '' : 's') + ' without a response.' : 'Every question has a response.') + ' You can’t change your answers after submitting.',
      '<button class="btn quiet" data-act="close">Keep working</button><button class="btn quiet" data-act="reset-attempt" data-id="' + id + '">Reset attempt</button><button class="btn" data-act="final" data-id="' + id + '">Confirm submission</button>');
  }
  function finishAssessment(id) {
    stopTicker();
    var live = state.live[id];
    if (!live) return;
    var list = qs(id);
    var answers = list.map(function (_, i) { return live.answers[i] || {}; });
    var marks = list.map(function (q, i) { return autoMark(q, answers[i]); });
    var usedBefore = attemptsUsed(id);
    state.history.push({ key: id, at: Date.now(), answers: answers, marks: marks, auto: marks.slice(), by: {}, questions: list });
    state.used = state.used || {};
    state.used[id] = usedBefore + 1;
    delete state.live[id];
    var earned = answers.filter(hasResponse).length * 2 >= list.length && award('finish', 'd:' + new Date().toDateString() + ':' + id);
    save();
    closeModal();
    var index = state.history.length - 1, run = state.history[index];
    serveOrder(runScore(run), runTotal(run)).then(function (finished) {
      if (!finished) return;
      justServed = true;
      location.hash = '#results-' + index;
      if (earned) pointsToast('finish');
    });
  }

  /* The site's own mark, by comparing with the staff answer. 1 right, 0 not yet, null for the teacher to mark.
     The teacher can change any of these from the Staff page. */
  function keyText(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function autoMark(q, a) {
    a = a || {};
    if (!hasResponse(a)) return 0;
    if (q.kind === 'mc') return a.pick === q.a ? 1 : 0;
    var typed = a.answer && a.answer.trim();
    if (q.kind === 'expr' || (q.kind === 'multi' && q.expected)) {
      if (!typed) return q.kind === 'expr' ? 0 : null;
      var same = sameExpression(typed, q.expected);
      return same === null ? null : same ? 1 : 0;
    }
    if (q.kind === 'explain' && q.keys && q.keys.length && typed) {
      var text = keyText(typed);
      return q.keys.every(function (k) { return text.indexOf(keyText(k)) !== -1; }) ? 1 : 0;
    }
    return null;
  }

  /* Exposed so the marking rules can be tested. */
  window.__autoMark = autoMark;
  window.__evalAt = evaluate;

  /* ---------- Order served: the steak cooks to the score, then the results ---------- */
  var cook = { el: null, token: 0, anims: [], end: null };
  var justServed = false;
  function buildCook() {
    var el = document.createElement('div');
    el.id = 'cook';
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="cook-stage"><img class="cook-chef" src="' + SPRITES + 'chef-spatula.webp" alt="" width="372" height="420">' +
      '<svg class="cook-pan" viewBox="0 0 460 150" aria-hidden="true"><ellipse cx="200" cy="96" rx="190" ry="48" fill="#1c1714" stroke="#3e1c05" stroke-width="5"/><ellipse cx="200" cy="90" rx="165" ry="36" fill="#2c2420"/><path d="M380 86 L452 70 Q460 70 458 80 L456 88 Q454 94 446 94 L384 104 Z" fill="#3a2a20" stroke="#3e1c05" stroke-width="5"/><ellipse cx="200" cy="90" rx="150" ry="28" fill="none" stroke="#ff8a24" stroke-width="3" opacity=".35"/></svg>' +
      '<div class="cook-plate"></div><span class="puff" style="left:28%"></span><span class="puff" style="left:46%"></span><span class="puff" style="left:62%"></span>' +
      '<div class="cook-steak"></div><div class="served"></div><div class="cook-label"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function () { if (cook.end) cook.end(true); });
    cook.el = el;
  }
  function serveOrder(score, total) {
    return new Promise(function (resolve) {
      if (calmMotion()) { resolve(true); return; }
      if (!cook.el) buildCook();
      if (cook.end) cook.end(false);
      var el = cook.el, t = ++cook.token, stage = el.querySelector('.cook-stage'), steak = el.querySelector('.cook-steak'), served = el.querySelector('.served'), label = el.querySelector('.cook-label');
      var pct = total ? score / total * 100 : 0, level = LEVELS[levelIndex(pct)][0], shown = -1;
      function play(node, frames, opts) { var a = node.animate(frames, Object.assign({ fill: 'forwards' }, opts)); cook.anims.push(a); return a.finished.catch(function () {}); }
      function drawSteak(p) { p = Math.round(p); if (p !== shown) { shown = p; steak.innerHTML = steakPicture(p); } }
      function live() { return t === cook.token; }
      /* Finished or skipped: the overlay stays until the results page replaces what's under it. */
      cook.end = function (finished) {
        if (!live()) return;
        cook.token++;
        cook.end = null;
        if (!finished) clearCook();
        resolve(finished);
      };
      (async function () {
        var focus = view.querySelector('.focus');
        if (focus) {
          play(focus.querySelector('.fbar'), [{ transform: 'none' }, { transform: 'translateY(-110%)' }], { duration: 300, easing: 'ease-in' });
          await play(focus.querySelector('.fmain'), [{ opacity: 1 }, { opacity: 0, transform: 'translateY(20px)' }], { duration: 300 });
          if (!live()) return;
        }
        shown = -1; drawSteak(0); served.textContent = ''; label.textContent = 'Cooking…';
        el.hidden = false;
        play(stage, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 260 });
        await play(steak, [{ transform: 'translateY(-70vh) rotate(-30deg)' }, { transform: 'translateY(10px) rotate(0)', offset: .75 }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.5,0,.6,1)' });
        if (!live()) return;
        sizzle(false, 1.8);
        stage.querySelectorAll('.puff').forEach(function (p, i) { play(p, [{ opacity: 0, transform: 'translateY(0) scale(.6)' }, { opacity: 1, offset: .3 }, { opacity: 0, transform: 'translateY(-120px) scale(1.4)' }], { duration: 1100, delay: i * 260, iterations: 2, fill: 'none' }); });
        play(steak, [{ transform: 'none' }, { transform: 'translateY(-3px)' }, { transform: 'none' }], { duration: 160, iterations: 10, fill: 'none' });
        /* Cook from raw up to the score: a better score cooks longer. */
        await new Promise(function (done) {
          var start = performance.now(), dur = 600 + pct * 15;
          (function frame(now) {
            if (!live()) return done();
            var f = Math.min(1, (now - start) / dur), p = (1 - Math.pow(1 - f, 2)) * pct;
            drawSteak(p); label.textContent = LEVELS[levelIndex(p)][0];
            if (f < 1) requestAnimationFrame(frame); else done();
          })(start);
        });
        if (!live()) return;
        /* Plate up and serve. */
        play(stage.querySelector('.cook-pan'), [{ opacity: 1 }, { opacity: 0, transform: 'translateY(30px)' }], { duration: 300 });
        play(stage.querySelector('.cook-plate'), [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 120 });
        play(steak, [{ transform: 'none' }, { transform: 'translateY(-30px)', offset: .5 }, { transform: 'translateY(-6px)' }], { duration: 420, easing: 'ease-out' });
        play(stage.querySelector('.cook-chef'), [{ opacity: 0, transform: 'scaleX(-1) translateX(40%)' }, { opacity: 1, transform: 'scaleX(-1) translateX(0)' }], { duration: 380, delay: 200, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
        label.textContent = '';
        served.innerHTML = '<small>Order served</small>' + score + ' / ' + total + ' · ' + level;
        await play(served, [{ opacity: 0, transform: 'translateX(-50%) rotate(-6deg) scale(2.2)' }, { opacity: 1, transform: 'translateX(-50%) rotate(-6deg) scale(.94)', offset: .7 }, { opacity: 1, transform: 'translateX(-50%) rotate(-6deg) scale(1)' }], { duration: 300, delay: 450 });
        if (!live()) return;
        await wait(1300);
        if (cook.end) cook.end(true);
      })();
    });
  }
  function clearCook() {
    if (cook.end) { cook.end(false); return; }
    cook.anims.forEach(function (a) { a.cancel(); });
    cook.anims = [];
    if (cook.el) cook.el.hidden = true;
  }

  /* ---------- Results ---------- */
  function pageResults(index) {
    var run = state.history[Number(index)];
    if (!run) { location.hash = '#dashboard'; return; }
    var wasFresh = !!run.fresh;
    if (wasFresh) { delete run.fresh; save(); renderNav(navNow); }
    var def = defOf(run.key), score = runScore(run), review = run.marks.filter(function (m) { return m === null; }).length, strands = {};
    var runList = runQuestions(run);
    runList.forEach(function (q, i) {
      var s = strands[q.strand] || (strands[q.strand] = [0, 0]);
      s[1] += qValue(q);
      s[0] += (Number(run.marks[i]) || 0) * qValue(q);
    });
    /* Same doneness scale as My progress, so a score always means the same steak. */
    var total = runTotal(run), pct = total ? score / total * 100 : 0, done = LEVELS[levelIndex(pct)][0];
    view.innerHTML = '<section class="section paper clipboard" data-served><div class="eyebrow" style="text-align:center">Order served · ' + esc(def.title) + '</div><div class="score">' + fmtMarks(score) + ' / ' + total + '</div>' + steakPicture(pct, 'served-steak') +
      '<p style="text-align:center">Doneness: <b>' + done + '</b>' + (review ? '. ' + review + ' answer' + (review === 1 ? '' : 's') + ' waiting for your teacher to mark.' : '') + (wasFresh ? '<br><span class="new-tag">New feedback from your teacher below</span>' : '') + (teacherCanMark() ? '<br><small>Your teacher can check any answer and change its mark.</small>' : '') + '</p><div class="strands">' + Object.keys(strands).map(function (k) { return '<span>' + k + ' ' + fmtMarks(strands[k][0]) + '/' + strands[k][1] + '</span>'; }).join('') + '</div>' +
      '<div class="row" style="justify-content:center"><a class="btn small" href="#' + (isQuiz(run.key) ? 'quizzes' : 'tests') + '">Done</a><a class="btn small quiet" href="#dashboard">My progress</a></div></section>' +
      (answersHidden(run.key) ? '<section class="section paper"><h2>Answers are hidden for now</h2><p>Your teacher will share the answers for this one later. Your score is saved.</p></section>' : runList.map(function (q, i) {
        var a = run.answers[i] || {}, m = run.marks[i];
        var yours = q.kind === 'mc' ? (a.pick === undefined ? 'No answer' : tex(q.choices[a.pick])) : a.answer ? esc(a.answer) : 'No answer';
        var byTeacher = run.by && run.by[i];
        var v = qValue(q), note = run.notes && run.notes[i];
        var status = m === 1 ? '<span class="mark good">✓ ' + (byTeacher ? 'Marked correct by your teacher' : 'Correct') + (v > 1 ? ' · ' + v + '/' + v : '') + '</span>' :
          m === 0 ? '<span class="mark bad">✗ ' + (byTeacher ? 'Marked not yet by your teacher' : 'Not yet') + (v > 1 ? ' · 0/' + v : '') + '</span>' :
          m === null || m === undefined ? '<span class="mark rev">' + (teacherCanMark() ? '⏳ Waiting for your teacher' : 'Not marked yet') + '</span>' :
          '<span class="mark part">◐ Part marks from your teacher · ' + fmtMarks(m * v) + '/' + v + '</span>';
        var marker = note ? '<div class="teacher-note"><b>Your teacher says:</b> ' + esc(note) + '</div>' : '';
        return '<article class="paper review">' + katc(q) + '<h3>Question ' + (i + 1) + (v > 1 ? ' <small class="worth">' + v + ' marks</small>' : '') + '</h3><p>' + status + '</p>' + marker + '<p class="q-ask">' + esc(q.prompt || q.title) + '</p>' + formula(q) + '<p><b>Your answer:</b> ' + yours + '</p>' +
          (a.working ? '<p><b>Your working:</b> ' + esc(a.working) + '</p>' : '') + (a.sketch && a.sketch.s && a.sketch.s.length ? '<p><b>Your working:</b></p>' + sketchSvg(a.sketch) : '') +
          '<div class="note"><b>Worked solution</b><br>' + q.solution.map(rich).join('<br>') + '</div>' + sampleCard(q) + '</article>';
      }).join(''));
    if (justServed) {
      justServed = false;
      view.querySelector('[data-served]').animate([{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
  }

  /* ---------- My progress ---------- */
  function pageProgress() {
    function runs(group) {
      return Object.keys(group).map(function (id) {
        var list = state.history.filter(function (h) { return h.key === id; }), name = group[id].title.split(':')[0];
        if (!list.length) return '<li><span>' + name + '<b>Not tried</b></span></li>';
        var last = list[list.length - 1], prev = list[list.length - 2], change = prev ? halves(runScore(last) - runScore(prev)) : 0;
        var fresh = list.filter(function (h) { return h.fresh; }).pop();
        return '<li><a class="link-row" href="#results-' + state.history.indexOf(fresh || last) + '" style="text-decoration:none"><span>' + name + (list.length > 1 ? ' · attempt ' + list.length : '') + (fresh ? ' <span class="new-tag">New feedback</span>' : '') + '</span><b>' + scoreText(last) + (change ? ' (' + (change > 0 ? '+' + fmtMarks(change) : '−' + fmtMarks(Math.abs(change))) + ')' : '') + '</b></a></li>';
      }).join('');
    }
    var tally = {};
    Object.keys(COURSE.quizzes).concat(Object.keys(COURSE.tests)).forEach(function (id) {
      var run = latest(id);
      if (run) runQuestions(run).forEach(function (q, i) {
        if (!TOPICS[q.topic]) return;
        var t = tally[q.topic] || (tally[q.topic] = [0, 0]);
        t[1] += qValue(q);
        t[0] += (Number(run.marks[i]) || 0) * qValue(q);
      });
    });
    var topics = Object.keys(tally).sort(function (a, b) { return tally[a][0] / tally[a][1] - tally[b][0] / tally[b][1]; });
    var answered = COURSE.homework.filter(function (q) { return hasResponse(state.homework[q.id]); }).length, totalHw = COURSE.homework.length;
    var taken = Object.keys(COURSE.quizzes).concat(Object.keys(COURSE.tests)).filter(latest).length;
    view.innerHTML = hero('Reflect &amp; revisit', 'My progress', 'See how your quiz and test scores change after each attempt, and where to focus next.', art('chef-wave', '', 'width="150" height="200"')) +
      cheerCard() + donenessCard() + scoreSharingCard() + boardCard() +
      '<section class="section paper"><h2>' + (topics.length ? 'Where to focus next' : 'No attempts yet') + '</h2>' + (topics.length ? '<p><b>' + TOPICS[topics[0]].title + '</b>: ' + tally[topics[0]][0] + ' of ' + tally[topics[0]][1] + ' marks in your latest attempts.</p><div class="row"><a class="btn small" href="#lessons-' + topics[0] + '">Open the lesson</a></div>' : '<p>Finish a quiz or test and your score will appear here, so you can see how you improve from one attempt to the next.</p>') +
      barRow('Assessments tried', taken + '/4', taken * 25) + barRow('Homework answered', answered + '/' + totalHw, answered / totalHw * 100) + '</section>' +
      '<section class="section grid g2"><div class="paper"><h2>Quizzes</h2><ul class="lines">' + runs(COURSE.quizzes) + '</ul><div class="row"><a class="btn small" href="#quizzes">Go to quizzes</a></div></div><div class="paper"><h2>Tests</h2><ul class="lines">' + runs(COURSE.tests) + '</ul><div class="row"><a class="btn small" href="#tests">Go to tests</a></div></div></section>' +
      '<div class="row"><a class="btn small" href="#mistakes">Review my mistakes</a><button class="btn small quiet" data-act="formulas">Formula sheet</button><button class="btn small quiet" data-act="reset">Start over</button></div>';
    startBoard();
  }

  /* ---------- Words of encouragement on My progress ----------
     The main line fits what the student has just done. The second line changes each day. */
  var CHEERS = [
    'Mistakes are just ingredients. Review them and the next dish comes out better.',
    'A little practice every day beats one long night before the test.',
    'Calculus is learned by doing. Every question you try counts, right or wrong.',
    'Stuck is normal. Open the hint, read the worked solution, then try the next one.',
    'You don’t have to be fast. You just have to keep going.',
    'The questions that feel hard today are the ones you’ll be proud of next week.',
    'Show your working. It’s how you find your own mistakes, and how marks are earned.',
    'Slow and steady cooks the steak. Rushing only burns it.'
  ];
  function cheerCard() {
    var ids = Object.keys(COURSE.quizzes).concat(Object.keys(COURSE.tests));
    var runs = state.history.filter(function (h) { return ids.indexOf(h.key) !== -1; });
    var last = runs[runs.length - 1], name = state.profile && state.profile.name ? String(state.profile.name).split(' ')[0] : '';
    var hwDone = COURSE.homework.filter(function (q) { return hasResponse(state.homework[q.id]); }).length;
    var head, text;
    if (!last && !hwDone) {
      head = 'Every chef starts with a cold pan';
      text = 'Nothing here yet, and that’s fine. Try one homework question or open a lesson, and this page starts filling up.';
    } else if (!last) {
      head = 'Good start' + (name ? ', ' + name : '');
      text = 'You’ve answered ' + hwDone + ' homework question' + (hwDone === 1 ? '' : 's') + '. When you feel ready, try a quiz. It’s only a check, not a verdict.';
    } else {
      var same = runs.filter(function (h) { return h.key === last.key; }), prev = same[same.length - 2];
      var title = defOf(last.key).title.split(':')[0], total = runTotal(last), pct = total ? runScore(last) / total * 100 : 0;
      var change = prev ? halves(runScore(last) - runScore(prev)) : 0, waiting = last.marks.filter(function (m) { return m === null; }).length;
      if (prev && change > 0) { head = 'You’re improving' + (name ? ', ' + name : ''); text = 'Your ' + title + ' score went up by ' + fmtMarks(change) + ' mark' + (change === 1 ? '' : 's') + ' since your last attempt. That’s your practice paying off.'; }
      else if (pct >= 85) { head = 'Well done' + (name ? ', ' + name : ''); text = 'You scored ' + scoreText(last) + ' on ' + title + '. That’s a properly cooked result. Help a classmate, or try the next one.'; }
      else if (pct >= 50) { head = 'You’re getting there' + (name ? ', ' + name : ''); text = 'You scored ' + scoreText(last) + ' on ' + title + '. More than half is solid ground. Review my mistakes will show you where the rest of the marks are.'; }
      else if (prev && change < 0) { head = 'A tougher attempt this time'; text = 'Your ' + title + ' score dipped, and that happens to everyone. Look through the worked solutions, then come back to it fresh.'; }
      else { head = 'This is where learning happens' + (name ? ', ' + name : ''); text = 'You scored ' + scoreText(last) + ' on ' + title + '. A low score now just shows you what to practise. Start with one lesson and one mistake.'; }
      if (waiting) text += ' ' + waiting + ' answer' + (waiting === 1 ? ' is' : 's are') + ' still waiting for your teacher, so your score may go up.';
    }
    var day = Math.floor(Date.now() / 86400000);
    return '<section class="section paper cheer" data-cheer><div class="cheer-text"><div class="eyebrow">A note from the kitchen</div><h2>' + esc(head) + '</h2><p>' + esc(text) + '</p><p class="cheer-quote">“' + CHEERS[day % CHEERS.length] + '”</p></div></section>';
  }

  /* ---------- Doneness: how cooked your calculus is ---------- */
  var LEVELS = [['Raw', 0], ['Rare', 5], ['Medium Rare', 25], ['Medium', 45], ['Medium Well', 65], ['Well Done', 85]];
  function levelIndex(pct) { var i = 0; LEVELS.forEach(function (l, n) { if (pct >= l[1]) i = n; }); return i; }
  /* Each topic: 40% homework answered, 60% marks across all four assessments. Untried assessments count as no marks yet. */
  function doneness() {
    var ids = Object.keys(COURSE.quizzes).concat(Object.keys(COURSE.tests));
    var topics = TOPIC_ORDER.map(function (t) {
      var hw = COURSE.homework.filter(function (q) { return q.topic === t; });
      var answered = hw.filter(function (q) { return hasResponse(state.homework[q.id]); }).length, marks = 0, possible = 0;
      ids.forEach(function (id) {
        var run = latest(id), list = run ? runQuestions(run) : defOf(id).questions;
        list.forEach(function (q, i) { if (q.topic !== t) return; possible += qValue(q); if (run) marks += (Number(run.marks[i]) || 0) * qValue(q); });
      });
      var hwPart = hw.length ? answered / hw.length : 0, testPart = possible ? marks / possible : 0;
      var pct = hw.length && possible ? hwPart * 40 + testPart * 60 : (hw.length ? hwPart : testPart) * 100;
      return { id: t, title: TOPICS[t].title, pct: Math.round(pct) };
    });
    var total = topics.reduce(function (sum, t) { return sum + t.pct; }, 0) / (topics.length || 1);
    return { pct: Math.round(total), topics: topics };
  }
  /* A sliced steak that cooks with the score: the cut face goes from raw red to grey-brown, the crust darkens and grill marks appear. */
  var STEAK_STOPS = [
    [0, '#8c1d3b', '#b3343f', 0], [5, '#c3283a', '#8f3a2b', .35], [25, '#d84552', '#7c3822', .55],
    [45, '#e2817e', '#6c3218', .7], [65, '#c9967f', '#5c2a13', .82], [85, '#9a7563', '#48210d', .92], [100, '#8a6656', '#3d1c0b', 1]
  ];
  function mix(a, b, f) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    return '#' + [16, 8, 0].map(function (sh) { var c = Math.round(((x >> sh) & 255) * (1 - f) + ((y >> sh) & 255) * f); return (c < 16 ? '0' : '') + c.toString(16); }).join('');
  }
  var steakCount = 0;
  function steakPicture(pct, cls) {
    pct = Math.max(0, Math.min(100, pct));
    var i = 0; while (i < STEAK_STOPS.length - 2 && pct >= STEAK_STOPS[i + 1][0]) i++;
    var lo = STEAK_STOPS[i], hi = STEAK_STOPS[i + 1], f = (pct - lo[0]) / (hi[0] - lo[0] || 1);
    var inside = mix(lo[1], hi[1], f), crust = mix(lo[2], hi[2], f), marks = lo[3] + (hi[3] - lo[3]) * f, n = 'st' + (++steakCount);
    var top = 'M24 62C26 34 70 20 112 22C140 10 196 8 236 20C274 30 292 52 284 76C278 98 240 104 196 102C160 110 108 108 72 100C38 94 20 84 24 62Z';
    var grill = [70, 115, 160, 205, 250].map(function (x) { return '<path d="M' + x + ' 8l-42 104" stroke="#2a1006" stroke-width="7" stroke-linecap="round"/>'; }).join('');
    var fat = '<path d="M58 52c22-10 40 6 62-4s38-8 52 2M100 82c18-8 30 4 48-3s30-6 44 4M190 46c14-6 24 2 38-2" stroke="#fbe9df" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="' + (.75 - marks * .45).toFixed(2) + '"/>';
    return '<span class="done-steak ' + (cls || '') + '"><svg viewBox="0 0 310 152" aria-hidden="true"><defs>' +
      '<linearGradient id="' + n + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + crust + '"/><stop offset=".16" stop-color="' + mix(inside, crust, .25) + '"/><stop offset=".5" stop-color="' + inside + '"/><stop offset=".84" stop-color="' + mix(inside, crust, .25) + '"/><stop offset="1" stop-color="' + crust + '"/></linearGradient>' +
      '<radialGradient id="' + n + 't" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="' + mix(crust, '#ffffff', .12) + '"/><stop offset="1" stop-color="' + crust + '"/></radialGradient>' +
      '<clipPath id="' + n + 'k"><path d="' + top + '"/></clipPath></defs>' +
      '<ellipse cx="156" cy="142" rx="132" ry="8" fill="#3d1c0b" opacity=".25"/>' +
      '<path d="M284 76C278 98 240 104 196 102C160 110 108 108 72 100C38 94 20 84 24 62L24 92C20 114 38 124 72 130C108 138 160 140 196 132C240 134 278 128 284 106Z" fill="url(#' + n + 'c)" stroke="#3e1c05" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M236 50C262 60 276 84 270 112" stroke="#f6e3c4" stroke-width="6" fill="none" opacity=".75" stroke-linecap="round"/>' +
      '<path d="' + top + '" fill="url(#' + n + 't)"/>' +
      '<g clip-path="url(#' + n + 'k)">' + fat + '<g opacity="' + marks.toFixed(2) + '">' + grill + '</g>' +
      '<path d="M112 22C140 10 196 8 236 20C274 30 292 52 284 76" stroke="' + mix('#f6e3c4', crust, marks * .55) + '" stroke-width="13" fill="none"/></g>' +
      '<path d="' + top + '" fill="none" stroke="#3e1c05" stroke-width="3"/>' +
      '<path d="M60 40C84 30 104 30 124 32" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="' + (.35 - marks * .25).toFixed(2) + '" stroke-linecap="round"/></svg></span>';
  }
  window.__steak = steakPicture;
  function donenessCard() {
    var d = doneness(), i = levelIndex(d.pct), next = LEVELS[i + 1];
    return '<section class="section paper"><div class="eyebrow">How cooked is your calculus?</div><h2>' + LEVELS[i][0] + '</h2>' +
      steakPicture(d.pct, 'big') +
      '<ol class="done-scale" aria-label="Doneness levels">' + LEVELS.map(function (l, n) { return '<li' + (n === i ? ' class="on" aria-current="step"' : '') + '>' + l[0] + '</li>'; }).join('') + '</ol>' +
      '<p>' + d.pct + '% cooked.' + (next ? ' Reach ' + next[1] + '% for ' + next[0] + '. Answer homework and score marks on quizzes and tests to cook it further.' : ' Nothing left to cook. Well done!') + '</p>' +
      '<ul class="done-topics">' + d.topics.map(function (t) {
        return '<li><a href="#lessons-' + t.id + '">' + steakPicture(t.pct) + '<span>' + esc(t.title) + '</span><b>' + LEVELS[levelIndex(t.pct)][0] + '</b></a></li>';
      }).join('') + '</ul></section>';
  }

  /* ---------- Sending scores to staff ----------
     Each student writes only their own record, results/<their id>. The publish rules let staff read every
     record and stop students reading anyone else's. Progress still lives in the browser if this can't run. */
  var scoreStatus = 'idle', scoreSending = false, scoreAgain = false, editingName = false;
  function scoreCopy() {
    var d = doneness();
    return {
      name: state.profile.name, cls: state.profile.cls, pct: d.pct,
      homework: COURSE.homework.filter(function (q) { return hasResponse(state.homework[q.id]); }).length, homeworkTotal: COURSE.homework.length,
      attempts: state.history.map(function (h) { return { key: h.key, at: h.at, score: runScore(h), total: runTotal(h), unmarked: h.marks.filter(function (m) { return m === null; }).length }; }),
      details: answerDetails()
    };
  }
  /* The latest two attempts at each quiz and test, with every answer, so staff can check the marks.
     Drawings are dropped, oldest first, if the record would get too big to save. */
  function answerDetails() {
    var out = {}, picked = [];
    Object.keys(BASE_MINUTES).forEach(function (key) { picked = picked.concat(state.history.filter(function (h) { return h.key === key; }).slice(-2)); });
    picked.sort(function (a, b) { return a.at - b.at; }).forEach(function (h) {
      var list = runQuestions(h);
      out[h.at] = { key: h.key, at: h.at, q: list.map(function (q, i) {
        var a = h.answers[i] || {}, auto = h.auto ? h.auto[i] : h.marks[i];
        var row = { id: q.id, t: String(q.title || '').slice(0, 160), k: q.kind, s: strandOf(q), v: qValue(q), m: auto === undefined ? null : auto };
        if (a.pick !== undefined) row.pick = a.pick;
        if (a.answer) row.ans = String(a.answer).slice(0, 3000);
        if (a.sketch && a.sketch.s && a.sketch.s.length) row.sk = a.sketch;
        return row;
      }) };
    });
    var keys = Object.keys(out).sort(function (a, b) { return a - b; }), n = 0;
    while (JSON.stringify(out).length > 200000 && n < keys.length) {
      out[keys[n]].q.forEach(function (r) { if (r.sk) { delete r.sk; r.skGone = 1; } });
      n++;
    }
    return out;
  }
  async function sendScores() {
    await staff.ready;
    if (state.board && staff.db) sendBoard().catch(function () { /* tries again on the next change */ });
    if (!state.profile) return;
    if (scoreSending) { scoreAgain = true; return; }
    scoreSending = true;
    try {
      await staff.ready;
      var id = staff.db && staff.user ? await staff.user.id() : '';
      if (!id) { scoreStatus = 'off'; return; }
      var copy = scoreCopy(), sig = JSON.stringify(copy);
      if (sig === state.sentSig) { scoreStatus = 'ok'; return; }
      var ref = staff.db.doc('results/' + id), snap = await ref.get(), old = snap.exists ? (snap.data().attempts || []) : [];
      /* Attempts are matched by time, so "Start over" or a second device keeps the teacher's record. */
      var merged = {};
      old.concat(copy.attempts).forEach(function (a) { merged[a.at] = a; });
      copy.attempts = Object.keys(merged).map(function (k) { return merged[k]; }).sort(function (a, b) { return a.at - b.at; }).slice(-200);
      copy.updatedAt = Date.now();
      if (JSON.stringify(copy).length > 240000) copy.details = {};
      await ref.set(copy);
      state.sentSig = sig;
      persist();
      scoreStatus = 'ok';
    } catch (e) {
      scoreStatus = 'off';
    } finally {
      scoreSending = false;
      showScoreStatus();
      if (scoreAgain) { scoreAgain = false; sendScores(); }
    }
  }
  function scoreStatusText() {
    if (!state.profile) return 'Your scores stay on this device until you add your name.';
    if (scoreStatus === 'ok') return 'Your teacher can see your scores as ' + esc(state.profile.name) + ' (' + esc(state.profile.cls) + ').';
    if (scoreStatus === 'off') return 'These scores are saved on this device only, so your teacher can’t see them. Ask your teacher to give you Contributor access to this site.';
    return 'Sending your scores to your teacher…';
  }
  function showScoreStatus() { view.querySelectorAll('[data-score-status]').forEach(function (n) { n.innerHTML = scoreStatusText(); }); }
  function scoreSharingCard() {
    if (!window.claude || staffIsEditor) return '';
    if (editingName) return '<section class="section paper narrow">' + nameFormHtml() + '</section>';
    return '<section class="section paper"><h2>Sharing with your teacher</h2><p data-score-status>' + scoreStatusText() + '</p><p class="fine">Other students can’t see your name or scores.</p><div class="row"><button class="btn small quiet" data-act="name-edit">' + (state.profile ? 'Change my name or class' : 'Add my name') + '</button></div></section>';
  }
  function addScoreNote() {
    if (!window.claude || staffIsEditor || !view.querySelector('.score')) return;
    view.insertAdjacentHTML('beforeend', '<p class="page-note" style="color:var(--cream);margin-top:16px" data-score-status>' + scoreStatusText() + '</p>');
  }
  var staffIsEditor = false;
  /* The GitHub version keeps everything in this browser (see js/local.js). One device is both student and staff there. */
  var STANDALONE = !!(window.claude && window.claude.standalone);
  /* The ticket asks for a name only when scores can actually reach the teacher. */
  async function canShareScores() {
    try {
      await staff.ready;
      if (!staff.db || !staff.user || staffIsEditor) return false;
      return !!(await staff.user.id());
    } catch (e) { return false; }
  }
  function nameFormHtml() {
    var v = state.profile || { name: '', cls: '' };
    return '<h2>Who’s cooking?</h2><p>Your teacher sees your name, class and scores. Other students don’t.</p><form data-form="student-name">' +
      '<label class="lbl" for="st-name">Your name</label><input class="math-in" id="st-name" maxlength="60" autocomplete="name" required value="' + esc(v.name) + '">' +
      '<label class="lbl" for="st-class">Your class</label><input class="math-in" id="st-class" maxlength="30" required placeholder="For example: 12A" value="' + esc(v.cls) + '">' +
      '<p class="form-msg" data-msg role="status"></p><div class="row"><button class="btn" type="submit">Continue</button></div></form>';
  }

  /* ---------- Progress that follows the student between devices ----------
     Saved privately at data/users/<id>/progress. Photos stay on the device because they're too big. */
  var cloud = { ready: null, ref: null };
  function loadCloud() {
    cloud.ready = (async function () {
      await staff.ready;
      var id = staff.db && staff.user ? await staff.user.id() : '';
      if (!id) return;
      cloud.ref = staff.db.doc('data/users/' + id + '/progress');
      var snap = await cloud.ref.get();
      if (snap.exists && mergeCloud(snap.data() || {})) { persist(); staffChanged(); }
      sendProgress();
      sendScores();
      watchTeacherMarks(id);
    })().catch(function () { cloud.ref = null; });
  }
  /* ---------- Marks from the teacher ----------
     Staff write marks/<student id> as { m: { "<attempt time>:<question number>": 1 or 0 } }.
     Only staff can write it, and each student can read only their own. */
  var teacherMarksOn = false;
  function teacherCanMark() { return teacherMarksOn && !!state.profile; }
  function watchTeacherMarks(id) {
    teacherMarksOn = true;
    staff.db.doc('marks/' + id).onSnapshot(function (snap) {
      var d = (snap.exists && snap.data()) || {};
      var hadFresh = freshRuns().length;
      if (applyTeacherMarks(d.m || {}, d.c || {})) {
        save();
        var page = parts()[0];
        /* Tell the student, unless they are mid-quiz or already reading that page. */
        var nowFresh = freshRuns();
        if (nowFresh.length > hadFresh && page !== 'results' && !document.documentElement.classList.contains('focusing')) toast('Your teacher left feedback on ' + AREAS[nowFresh[nowFresh.length - 1].key] + '. See My progress.');
        renderNav(navNow);
        if (page === 'results' || page === 'dashboard' || page === 'mistakes') { var y = window.scrollY; renderPage(); window.scrollTo(0, y); }
      }
    }, function () { teacherMarksOn = false; });
  }
  function validMark(v) { return typeof v === 'number' && v >= 0 && v <= 1; }
  /* Attempts with teacher marks or comments the student has not opened yet. */
  function freshRuns() { return state.history.filter(function (h) { return h && h.fresh; }); }
  function applyTeacherMarks(m, c) {
    var changed = false;
    state.history.forEach(function (run) {
      if (!run.auto) run.auto = run.marks.slice();
      run.by = run.by || {};
      run.notes = run.notes || {};
      run.marks.forEach(function (_, i) {
        var v = m[run.at + ':' + i], by = validMark(v), next = by ? v : run.auto[i];
        if (run.marks[i] !== next || !!run.by[i] !== by) { run.marks[i] = next; if (by) { run.by[i] = 1; run.fresh = true; } else delete run.by[i]; changed = true; }
        var note = typeof c[run.at + ':' + i] === 'string' ? c[run.at + ':' + i].slice(0, 600) : '';
        if ((run.notes[i] || '') !== note) { if (note) { run.notes[i] = note; run.fresh = true; } else delete run.notes[i]; changed = true; }
      });
    });
    return changed;
  }
  function mergeCloud(c) {
    var before = JSON.stringify([state.history, state.homework, state.live, state.fixed, state.profile, state.board, state.pts]);
    var resetAt = Math.max(Number(c.resetAt) || 0, state.resetAt || 0), hwResetAt = Math.max(Number(c.hwResetAt) || 0, state.hwResetAt || 0);
    if ((Number(c.resetAt) || 0) > (state.resetAt || 0)) { state.homework = {}; state.live = {}; state.fixed = {}; }
    if ((Number(c.hwResetAt) || 0) > (state.hwResetAt || 0)) state.homework = {};
    state.resetAt = resetAt; state.hwResetAt = hwResetAt;
    var runs = {};
    (Array.isArray(c.history) ? c.history : []).concat(state.history).forEach(function (h) { if (h && h.at > resetAt) runs[h.at] = h; });
    state.history = Object.keys(runs).map(function (k) { return runs[k]; }).sort(function (a, b) { return a.at - b.at; });
    state.homework = Object.assign({}, c.homework || {}, state.homework);
    state.live = Object.assign({}, c.live || {}, state.live);
    Object.keys(state.live).forEach(function (id) { if (state.history.some(function (h) { return h.key === id && h.at >= (state.live[id].deadline || 0) - 86400000 && c.live && !c.live[id] && h.at > (Number(c.savedAt) || 0) - 1; })) delete state.live[id]; });
    state.fixed = Object.assign({}, c.fixed || {}, state.fixed || {});
    if (!state.profile && c.profile) state.profile = c.profile;
    if (!state.board && c.board) state.board = c.board;
    /* Attempts used: the larger count wins, so a second device or "Start over" never hands attempts back. */
    if (c.used && typeof c.used === 'object') {
      state.used = state.used || {};
      Object.keys(c.used).forEach(function (k) { if (BASE_MINUTES[k]) state.used[k] = Math.max(Number(state.used[k]) || 0, Math.min(999, Math.round(Number(c.used[k]) || 0))); });
    }
    /* Points: the larger count wins for each week and for the total, so two devices never lose any. */
    if (c.pts && typeof c.pts === 'object') {
      var mp = pts(), cw = c.pts.weeks || {};
      Object.keys(cw).forEach(function (k) { mp.weeks[k] = Math.max(Number(mp.weeks[k]) || 0, Number(cw[k]) || 0); });
      mp.all = Math.max(mp.all, Number(c.pts.all) || 0);
      mp.got = Object.assign({}, c.pts.got || {}, mp.got);
    }
    return before !== JSON.stringify([state.history, state.homework, state.live, state.fixed, state.profile, state.board, state.pts]);
  }
  var progressSending = false, progressAgain = false;
  async function sendProgress() {
    if (progressSending) { progressAgain = true; return; }
    if (cloud.ready) await cloud.ready;
    if (!cloud.ref) return;
    progressSending = true;
    try {
      var copy = { history: state.history.slice(-60), homework: state.homework, live: state.live, fixed: state.fixed || {}, resetAt: state.resetAt || 0, hwResetAt: state.hwResetAt || 0, profile: state.profile || null, board: state.board || null, pts: state.pts || null, used: state.used || null };
      /* A record holds 256 KB at most, so the oldest attempts drop out of the shared copy first. */
      while (JSON.stringify(copy).length > 230000 && copy.history.length) copy.history = copy.history.slice(1);
      var sig = JSON.stringify(copy);
      if (sig !== state.cloudSig) { copy.savedAt = Date.now(); await cloud.ref.set(copy); state.cloudSig = sig; persist(); }
    } catch (e) { /* It stays on this device and tries again on the next change. */ }
    progressSending = false;
    if (progressAgain) { progressAgain = false; sendProgress(); }
  }

  /* ---------- Staff controls for each quiz and test ---------- */
  var BASE_MINUTES = {};
  ['quizzes', 'tests'].forEach(function (k) { Object.keys(COURSE[k]).forEach(function (id) { BASE_MINUTES[id] = COURSE[k][id].minutes; }); });
  function control(id) { return staffData.controls[id] || {}; }
  function isOpen(id) { return control(id).open !== false; }
  /* Attempts allowed for each quiz and test. 0 means unlimited. Staff are never limited, so they can test.
     The count survives "Start over" and follows the student to other devices. */
  function attemptLimit(id) { var n = Math.round(Number(control(id).attempts) || 0); return staffIsEditor || n < 1 ? 0 : Math.min(20, n); }
  function attemptsUsed(id) { return Math.max(state.history.filter(function (h) { return h.key === id; }).length, Number((state.used || {})[id]) || 0); }
  function attemptsLeft(id) { var n = attemptLimit(id); return n ? Math.max(0, n - attemptsUsed(id)) : Infinity; }
  function answersHidden(id) { return control(id).hideAnswers === true; }
  function applyControls() {
    Object.keys(BASE_MINUTES).forEach(function (id) {
      var m = Number(control(id).minutes);
      defOf(id).minutes = m >= 1 && m <= 300 ? Math.round(m) : BASE_MINUTES[id];
    });
  }
  function drawControls() {
    var holder = view.querySelector('[data-controls]');
    if (!holder || holder.contains(document.activeElement)) return; /* Never redraw under someone's cursor. */
    holder.innerHTML = '<div class="results-wrap"><table class="results"><thead><tr><th scope="col">Assessment</th><th scope="col">Open to students</th><th scope="col">Time limit (minutes)</th><th scope="col">Attempts allowed</th><th scope="col">Show answers after submitting</th></tr></thead><tbody>' +
      Object.keys(BASE_MINUTES).map(function (id) {
        return '<tr><th scope="row">' + AREAS[id] + '</th><td><input type="checkbox" data-control="' + id + '" data-ctl="open" aria-label="' + AREAS[id] + ' open"' + (isOpen(id) ? ' checked' : '') + '></td>' +
          '<td><input class="math-in num-in" type="number" min="1" max="300" data-control="' + id + '" data-ctl="minutes" aria-label="' + AREAS[id] + ' time limit in minutes" value="' + defOf(id).minutes + '"></td>' +
          '<td><select class="math-in attempts-in" data-control="' + id + '" data-ctl="attempts" aria-label="' + AREAS[id] + ' attempts allowed">' + [[0, 'Unlimited'], [1, '1'], [2, '2'], [3, '3'], [5, '5']].map(function (o) { return '<option value="' + o[0] + '"' + ((Math.round(Number(control(id).attempts)) || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td>' +
          '<td><input type="checkbox" data-control="' + id + '" data-ctl="show" aria-label="Show ' + AREAS[id] + ' answers after submitting"' + (answersHidden(id) ? '' : ' checked') + '></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  document.addEventListener('change', async function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.control) return;
    var id = el.dataset.control, row = view.querySelectorAll('[data-control="' + id + '"]'), next = Object.assign({}, control(id));
    row.forEach(function (c) {
      if (c.dataset.ctl === 'open') next.open = c.checked;
      if (c.dataset.ctl === 'show') next.hideAnswers = !c.checked;
      if (c.dataset.ctl === 'minutes') next.minutes = Number(c.value);
      if (c.dataset.ctl === 'attempts') next.attempts = Math.max(0, Math.min(20, Math.round(Number(c.value)) || 0));
    });
    if (!(next.minutes >= 1 && next.minutes <= 300)) { toast('Use a time limit between 1 and 300 minutes.'); drawControls(); return; }
    next.minutes = Math.round(next.minutes);
    try { await staff.db.doc('controls/' + id).set(next); toast('Saved. Attempts already running keep their time.'); } catch (err) { toast('That couldn’t be saved. Try again.'); }
  });

  /* ---------- Questions per skill: how many K, A, T and C questions each quiz or test gives ----------
     Objective questions are multiple choice (A, B, C or D), marked by the site.
     Subjective ones are marked by the student against the worked solution (worked answer, explanation).
     With no plan, a quiz or test gives every question in its bank. With a plan, each attempt draws
     that many of each from the bank at random, in K, A, T, C order. */
  /* Objective means multiple choice: the student picks A, B, C or D. */
  function isObjective(q) { return q.kind === 'mc'; }
  function bankOf(id) { return defOf(id).questions; }
  function bankCount(id, strand, objective) { return bankOf(id).filter(function (q) { return strandOf(q) === strand && isObjective(q) === objective; }).length; }
  function planOf(id) {
    var raw = control(id).plan, plan = {}, total = 0;
    if (!raw || typeof raw !== 'object') return null;
    STRANDS.forEach(function (t) {
      var r = raw[t] || {}, o = Math.max(0, Math.min(20, Math.round(Number(r.o) || 0))), sj = Math.max(0, Math.min(20, Math.round(Number(r.s) || 0)));
      plan[t] = { o: o, s: sj }; total += o + sj;
    });
    return total ? plan : null;
  }
  function shuffled(list) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pickQuestions(id) {
    var plan = planOf(id), bank = bankOf(id), out = [];
    if (!plan) return bank.slice();
    STRANDS.forEach(function (t) {
      [true, false].forEach(function (obj) {
        var pool = bank.filter(function (q) { return strandOf(q) === t && isObjective(q) === obj; });
        out = out.concat(shuffled(pool).slice(0, plan[t][obj ? 'o' : 's']));
      });
    });
    return out.length ? out : bank.slice();
  }
  function plannedCount(id) {
    var plan = planOf(id);
    if (!plan) return bankOf(id).length;
    var n = 0;
    STRANDS.forEach(function (t) { n += Math.min(plan[t].o, bankCount(id, t, true)) + Math.min(plan[t].s, bankCount(id, t, false)); });
    return n || bankOf(id).length;
  }
  function drawPlans() {
    var holder = view.querySelector('[data-plans]');
    if (!holder) return;
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT' && holder.contains(a)) return;
    if (!BASE_MINUTES[bank.tab]) { holder.innerHTML = '<p class="fine bank-note">Homework gives students every question, so there’s no plan to set.</p>'; return; }
    holder.innerHTML = '<div class="plans">' + [bank.tab].map(function (id) {
      var plan = planOf(id), short = [], total = 0;
      var rows = STRANDS.map(function (t) {
        return '<tr><th scope="row"><span class="katc-mini" aria-hidden="true">' + t.charAt(0) + '</span>' + t + '</th>' + [true, false].map(function (obj) {
          var have = bankCount(id, t, obj), want = plan ? plan[t][obj ? 'o' : 's'] : have;
          total += Math.min(want, have);
          if (want > have) short.push(t + ' ' + (obj ? 'objective' : 'subjective') + ': ' + have + ' in the bank, ' + want + ' wanted');
          var label = t + ' ' + (obj ? 'objective' : 'subjective');
          function step(n, sign) { return '<button type="button" class="step" data-act="plan-step" data-id="' + id + '" data-strand="' + t + '" data-type="' + (obj ? 'o' : 's') + '" data-step="' + n + '" aria-label="' + (n > 0 ? 'One more ' : 'One fewer ') + label + ' question"' + ((n < 0 && want <= 0) || (n > 0 && want >= 20) ? ' disabled' : '') + '>' + sign + '</button>'; }
          return '<td><div class="stepper">' + step(-1, '−') + '<input class="math-in num-in" type="number" min="0" max="20" inputmode="numeric" data-plan="' + id + '" data-strand="' + t + '" data-type="' + (obj ? 'o' : 's') + '" value="' + want + '" aria-label="' + AREAS[id] + ' ' + label + ' questions">' + step(1, '+') + '</div><small class="bank' + (want > have ? ' low' : '') + '">' + have + ' in bank</small></td>';
        }).join('') + '</tr>';
      }).join('');
      return '<article class="plan"><div class="plan-head"><h3>Questions per skill</h3><b>' + total + ' question' + (total === 1 ? '' : 's') + '</b></div>' +
        '<p class="fine">' + (plan ? 'Each attempt draws these at random from the bank.' : 'No plan yet: students get every question in the bank. Change a number to set one.') + '</p>' +
        '<div class="results-wrap"><table class="results plan-table"><thead><tr><th scope="col">Skill</th><th scope="col">Objective</th><th scope="col">Subjective</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (short.length ? '<p class="form-msg bad">Not enough questions yet. ' + short.map(esc).join('; ') + '. Press <b>+ Add a question</b> below, or students get fewer.</p>' : '') +
        (plan ? '<div class="row"><button class="btn small quiet" data-act="plan-clear" data-id="' + id + '">Use every question instead</button></div>' : '') + '</article>';
    }).join('') + '</div>';
  }
  async function savePlan(id, plan) {
    var next = Object.assign({}, control(id));
    if (plan) next.plan = plan; else delete next.plan;
    try { await staff.db.doc('controls/' + id).set(next); toast(plan ? 'Saved. New attempts use this plan.' : 'Saved. ' + AREAS[id] + ' gives every question again.'); }
    catch (err) { toast('That couldn’t be saved. Try again.'); drawPlans(); }
  }
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.plan) return;
    var id = el.dataset.plan, plan = {}, total = 0, bad = false;
    STRANDS.forEach(function (t) { plan[t] = { o: 0, s: 0 }; });
    view.querySelectorAll('[data-plan="' + id + '"]').forEach(function (c) {
      var n = Number(c.value);
      if (!(n >= 0 && n <= 20) || n !== Math.round(n)) bad = true;
      plan[c.dataset.strand][c.dataset.type] = Math.max(0, Math.min(20, Math.round(n) || 0));
      total += plan[c.dataset.strand][c.dataset.type];
    });
    if (bad) { toast('Use whole numbers from 0 to 20.'); el.blur(); drawPlans(); return; }
    if (!total) { toast('A quiz or test needs at least one question.'); el.blur(); drawPlans(); return; }
    savePlan(id, plan);
  });

  /* ---------- Formula sheet ---------- */
  function formulasHtml() {
    return FORMULAS.map(function (g) {
      return '<h3 class="formula-head">' + esc(g.group) + '</h3><dl class="formula-list">' + g.items.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + tex(f[1], true) + '</dd></div>'; }).join('') + '</dl>';
    }).join('');
  }
  function pageFormulas() {
    view.innerHTML = hero('Keep this handy', 'Formula sheet', 'Every derivative rule used in this course, in one place.', art('chef-spatula', '', 'width="150" height="200"')) + '<section class="section paper">' + formulasHtml() + '</section>';
  }

  /* ---------- Review my mistakes ---------- */
  function pageMistakes() {
    var hiddenNames = [], cards = '';
    Object.keys(BASE_MINUTES).forEach(function (id) {
      var run = latest(id);
      if (!run) return;
      if (answersHidden(id)) { hiddenNames.push(AREAS[id]); return; }
      runQuestions(run).forEach(function (q, i) {
        if (run.marks[i] === null || run.marks[i] === undefined || run.marks[i] >= 1) return;
        var a = run.answers[i] || {}, key = run.at + ':' + i, fixed = (state.fixed || {})[key];
        var yours = q.kind === 'mc' ? (a.pick === undefined ? 'No answer' : tex(q.choices[a.pick])) : a.answer ? esc(a.answer) : 'No answer';
        var retry = fixed ? '<p class="mark good">✓ You fixed this one</p>' :
          q.kind === 'expr' ? '<label class="lbl" for="retry-' + key.replace(':', '-') + '">Try again</label><input class="math-in" id="retry-' + key.replace(':', '-') + '" data-retry="' + key + '" spellcheck="false" autocomplete="off"><div class="row"><button class="btn small" data-act="retry-check" data-key="' + key + '" data-run="' + run.at + '" data-i="' + i + '">Check answer</button></div><p class="form-msg" data-retry-msg="' + key + '" role="status"></p>' :
          q.kind === 'mc' ? '<p><b>Try again:</b></p><div class="row">' + q.choices.map(function (c, n) { return '<button class="btn small quiet" data-act="retry-pick" data-key="' + key + '" data-run="' + run.at + '" data-i="' + i + '" data-pick="' + n + '">' + LETTERS[n] + ': ' + tex(c) + '</button>'; }).join('') + '</div><p class="form-msg" data-retry-msg="' + key + '" role="status"></p>' : '';
        cards += '<article class="section paper review">' + katc(q) + '<div class="q-meta"><span>' + AREAS[id] + ' · Question ' + (i + 1) + '</span></div><p class="q-ask">' + esc(q.prompt || q.title) + '</p>' + formula(q) + '<p><b>Your answer:</b> ' + yours + '</p>' + retry +
          '<details class="note"><summary>Show the worked solution</summary>' + q.solution.map(rich).join('<br>') + '</details></article>';
      });
    });
    view.innerHTML = hero('Learn from it', 'Review my mistakes', 'Questions you got wrong in your latest quiz and test attempts. Retrying here doesn’t change your score.', art('chef-wave', '', 'width="150" height="200"')) +
      '<div class="row"><a class="btn small quiet" href="#dashboard">‹ My progress</a><button class="btn small quiet" data-act="formulas">Formula sheet</button></div>' +
      (hiddenNames.length ? '<section class="section paper"><p>Your teacher has hidden the answers for ' + hiddenNames.join(', ') + ' for now, so those questions aren’t shown.</p></section>' : '') +
      (cards || '<section class="section paper"><h2>Nothing to review</h2><p>Questions you get wrong in a quiz or test will appear here. Questions you still need to mark yourself appear on that attempt’s results page.</p></section>');
  }
  function retryResult(d, right) {
    var msg = view.querySelector('[data-retry-msg="' + d.key + '"]');
    if (right) {
      sizzle();
      state.fixed = state.fixed || {};
      if (!state.fixed[d.key]) { award('fix'); pointsToast('fix'); }
      state.fixed[d.key] = true;
      save();
      var y = window.scrollY; pageMistakes(); window.scrollTo(0, y);
      return;
    }
    if (msg) { msg.textContent = right === null ? 'That answer can’t be read. Try a form like 3x^2 + cos(x).' : 'Not yet. Try again, or open the worked solution.'; msg.classList.add('bad'); }
  }
  function retryQuestion(d) {
    var run = state.history.find(function (h) { return String(h.at) === String(d.run); });
    return run ? runQuestions(run)[Number(d.i)] : null;
  }

  /* ---------- More practice: new numbers every time ---------- */
  function rint(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function rnz(lo, hi) { var n = 0; while (!n) n = rint(lo, hi); return n; }
  /* Writes terms like [[3, 2], [-1, 1], [4, 0]] as 3x^2-x+4. */
  function polyTex(terms, v) {
    v = v || 'x';
    return terms.filter(function (t) { return t[0] !== 0; }).map(function (t, i) {
      var a = t[0], n = t[1], size = Math.abs(a), sign = a < 0 ? '-' : i ? '+' : '';
      return sign + (size === 1 && n !== 0 ? '' : size) + (n === 0 ? '' : n === 1 ? v : v + '^{' + n + '}');
    }).join('') || '0';
  }
  function polyPlain(terms, v) {
    v = v || 'x';
    return terms.map(function (t) { return '(' + t[0] + ')*' + v + '^(' + t[1] + ')'; }).join('+') || '0';
  }
  function polyDiff(terms) { return terms.filter(function (t) { return t[1] !== 0; }).map(function (t) { return [t[0] * t[1], t[1] - 1]; }); }
  var MAKERS = {
    product: function () {
      var u = [[rnz(-4, 5), rint(2, 3)], [rnz(-6, 6), 0]], v, trig = Math.random() < .3;
      if (trig) {
        var fn = Math.random() < .5 ? 'sin' : 'cos', dv = fn === 'sin' ? 'cos(x)' : '-sin(x)', dvTex = fn === 'sin' ? '\\cos x' : '-\\sin x', k = [[1, rint(2, 4)]];
        return { tex: 'f(x)=' + polyTex(k) + '\\' + fn + ' x', expected: '(' + polyPlain(polyDiff(k)) + ')*' + fn + '(x)+(' + polyPlain(k) + ')*(' + dv + ')',
          hint: 'Let $u=' + polyTex(k) + '$ and $v=\\' + fn + ' x$.',
          solution: ['$u\'=' + polyTex(polyDiff(k)) + '$ and $v\'=' + dvTex + '$.', '$f\'(x)=u\'v+uv\'=' + polyTex(polyDiff(k)) + '\\' + fn + ' x+' + polyTex(k) + '(' + dvTex + ')$.'] };
      }
      v = [[rnz(-4, 5), 1], [rnz(-6, 6), 0]];
      var du = polyDiff(u), dvv = polyDiff(v);
      return { tex: 'f(x)=(' + polyTex(u) + ')(' + polyTex(v) + ')', expected: '(' + polyPlain(du) + ')*(' + polyPlain(v) + ')+(' + polyPlain(u) + ')*(' + polyPlain(dvv) + ')',
        hint: 'Let $u=' + polyTex(u) + '$ and $v=' + polyTex(v) + '$.',
        solution: ['$u\'=' + polyTex(du) + '$ and $v\'=' + polyTex(dvv) + '$.', '$f\'(x)=u\'v+uv\'=(' + polyTex(du) + ')(' + polyTex(v) + ')+(' + polyTex(u) + ')(' + polyTex(dvv) + ')$.'] };
    },
    quotient: function () {
      var a, b, c, d;
      do { a = rnz(-5, 5); b = rnz(-6, 6); c = rnz(-4, 4); d = rnz(-6, 6); } while (a * d - b * c === 0);
      var u = [[a, 1], [b, 0]], v = [[c, 1], [d, 0]], top = a * d - b * c;
      return { tex: 'f(x)=\\frac{' + polyTex(u) + '}{' + polyTex(v) + '}', expected: '(' + top + ')/(' + polyPlain(v) + ')^2',
        hint: 'Let $u=' + polyTex(u) + '$ and $v=' + polyTex(v) + '$. Then use $\\frac{u\'v-uv\'}{v^2}$.',
        solution: ['$u\'=' + a + '$ and $v\'=' + c + '$.', '$f\'(x)=\\frac{(' + a + ')(' + polyTex(v) + ')-(' + polyTex(u) + ')(' + c + ')}{(' + polyTex(v) + ')^2}$.', 'The top simplifies to ' + top + ', so $f\'(x)=\\frac{' + top + '}{(' + polyTex(v) + ')^2}$.'] };
    },
    derivatives: function () {
      var p = [[rnz(-5, 6), rint(3, 5)], [rnz(-6, 6), 2], [rnz(-9, 9), 1], [rnz(-9, 9), 0]], extra = [['\\sin x', 'cos(x)', '\\cos x'], ['\\cos x', '-sin(x)', '-\\sin x'], ['e^x', 'e^x', 'e^x']][rint(0, 2)];
      return { tex: 'f(x)=' + polyTex(p) + '+' + extra[0], expected: polyPlain(polyDiff(p)) + '+' + extra[1],
        hint: 'Differentiate one term at a time. A constant term becomes 0.',
        solution: ['Use the power rule on each power of $x$.', 'The derivative of $' + extra[0] + '$ is $' + extra[2] + '$.', '$f\'(x)=' + polyTex(polyDiff(p)) + (extra[2].charAt(0) === '-' ? '' : '+') + extra[2] + '$.'] };
    },
    rates: function () {
      var a = rint(1, 5), b = rnz(-8, 9), c = rint(0, 12), t = rint(1, 6), s = [[a, 2], [b, 1], [c, 0]];
      return { prompt: 'A particle’s position in metres after t seconds is given below. Find its velocity, in m/s, at t = ' + t + '. Type just the number.', tex: 's(t)=' + polyTex(s, 't'), expected: String(2 * a * t + b),
        hint: 'Velocity is the derivative of position. Differentiate, then substitute $t=' + t + '$.',
        solution: ['$v(t)=s\'(t)=' + polyTex(polyDiff(s), 't') + '$.', '$v(' + t + ')=' + (2 * a) + '(' + t + ')' + (b < 0 ? '' : '+') + b + '=' + (2 * a * t + b) + '$ m/s.'] };
    }
  };
  var practice = null;
  function pagePractice(topic) {
    if (!MAKERS[topic]) { location.hash = '#practice-product'; return; }
    if (!practice || practice.topic !== topic) practice = { topic: topic, right: 0, q: MAKERS[topic]() };
    view.innerHTML = hero('Keep cooking', 'More practice', 'New numbers every time. This practice doesn’t change your scores.', art('chef-spatula', '', 'width="150" height="200"')) +
      '<div class="chips section" role="navigation" aria-label="Choose a topic">' + TOPIC_ORDER.map(function (t) { return '<a class="chip' + (t === topic ? ' on' : '') + '" href="#practice-' + t + '"' + (t === topic ? ' aria-current="true"' : '') + '>' + esc(TOPICS[t].title) + '</a>'; }).join('') + '</div><section class="section paper clipboard" data-practice></section>';
    drawPractice();
  }
  function drawPractice() {
    var box = view.querySelector('[data-practice]'), q = practice.q;
    if (!box) return;
    box.innerHTML = '<div class="practice-top">' + katc({ topic: practice.topic }) + '<button class="btn small quiet" data-act="practice-exit">Exit practice</button></div><div class="q-meta"><span>' + esc(TOPICS[practice.topic].title) + '</span><span>Right so far: ' + practice.right + '</span></div><p>' + esc(q.prompt || 'Find the derivative.') + '</p><div class="q-math">' + tex(q.tex, true) + '</div>' +
      '<label class="lbl" for="practice-in">Your answer</label><input class="math-in" id="practice-in" spellcheck="false" autocomplete="off" placeholder="For example: 3x^2 + cos(x)"' + (practice.done ? ' value="' + esc(practice.typed) + '" readonly' : '') + '>' +
      '<p class="form-msg' + (practice.bad ? ' bad' : '') + '" data-practice-msg role="status">' + (practice.msg || '') + '</p>' +
      '<div class="row">' + (practice.done ? '<button class="btn small" data-act="practice-new">Next question</button>' : '<button class="btn small" data-act="practice-check">Check answer</button><button class="btn small quiet" data-act="practice-new">Skip</button>') +
      '<button class="btn small quiet" data-act="practice-hint">Hint</button><button class="btn small quiet" data-act="practice-solution">Show solution</button><button class="btn small quiet" data-act="formulas">Formula sheet</button></div>' +
      (practice.showHint ? '<div class="note"><b>Hint:</b> ' + rich(q.hint) + '</div>' : '') + (practice.showSolution ? '<div class="note"><b>Worked solution</b><br>' + q.solution.map(rich).join('<br>') + '</div>' : '');
  }
  /* Exposed so the generators can be tested against a computer algebra system. */
  window.__makers = MAKERS;

  /* ---------- Sizzle sound (off until someone turns it on) ---------- */
  var audio = null;
  function sizzle(force, seconds) {
    if (!state.sound && !force) return;
    var len = seconds || .7;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var length = Math.floor(audio.sampleRate * len), buffer = audio.createBuffer(1, length, audio.sampleRate), data = buffer.getChannelData(0);
      for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < .55 ? 1 : .35);
      var src = audio.createBufferSource(), band = audio.createBiquadFilter(), gain = audio.createGain(), now = audio.currentTime;
      src.buffer = buffer; band.type = 'bandpass'; band.frequency.value = 5200; band.Q.value = .7;
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.13, now + .03); if (len > 1) gain.gain.setValueAtTime(.13, now + len - .4); gain.gain.exponentialRampToValueAtTime(.0001, now + len - .02);
      src.connect(band); band.connect(gain); gain.connect(audio.destination); src.start(now); src.stop(now + len);
    } catch (e) { /* No sound on this device. */ }
  }
  function drawSoundButton() {
    var btn = document.getElementById('sound-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'sound-btn';
      btn.type = 'button';
      btn.dataset.act = 'sound';
      document.querySelector('.top').appendChild(btn);
    }
    btn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    btn.setAttribute('aria-label', 'Sizzle sound on correct answers');
    btn.title = state.sound ? 'Sizzle sound is on' : 'Sizzle sound is off';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#3b1a0c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path fill="#3b1a0c" d="M4 9v6h4l5 4V5L8 9z"/>' + (state.sound ? '<path d="M16.500 9a4 4 0 0 1 0 6M19 6.500a8 8 0 0 1 0 11"/>' : '<path d="M17 9.500l5 5M22 9.500l-5 5"/>') + '</svg>';
  }

  /* ---------- Kitchen points: effort, not marks ----------
     Points come from doing things: practice, homework, fixing mistakes, finishing quizzes and tests.
     Wrong answers neither earn nor lose. Each week starts on Monday, local time. */
  var POINTS = { practice: [2, 'Correct in More practice'], homework: [3, 'Homework question correct'], fix: [3, 'Fixed a mistake'], finish: [5, 'Finished a quiz or test'] };
  var RANKS = [['Dishwasher', 0], ['Prep Cook', 15], ['Line Cook', 35], ['Sous Chef', 60], ['Head Chef', 90]];
  function weekKey(t) {
    var d = new Date(t || Date.now());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function pts() {
    var p = state.pts || (state.pts = {});
    p.all = Number(p.all) || 0; p.weeks = p.weeks || {}; p.got = p.got || {};
    return p;
  }
  function weekPoints() { return Number(pts().weeks[weekKey()]) || 0; }
  /* once: a key that can only earn once, such as one homework question per week. */
  function award(kind, once) {
    var p = pts(), wk = weekKey();
    if (once) {
      if (p.got[once]) return false;
      p.got[once] = wk;
    }
    p.all += POINTS[kind][0];
    p.weeks[wk] = (Number(p.weeks[wk]) || 0) + POINTS[kind][0];
    /* Old "once" keys only matter for the week they were earned in. */
    Object.keys(p.got).forEach(function (k) { if (p.got[k] !== wk && /^[wd]:/.test(k)) delete p.got[k]; });
    save();
    return true;
  }
  function pointsToast(kind) { toast('+' + POINTS[kind][0] + ' points · ' + POINTS[kind][1]); }
  function rankOf(points, scale) { var r = RANKS[0][0]; RANKS.forEach(function (x) { if (points >= x[1] * (scale || 1)) r = x[0]; }); return r; }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function record() {
    var p = pts(), weeks = p.weeks, best = 0, streak = 0;
    Object.keys(weeks).forEach(function (k) { best = Math.max(best, Number(weeks[k]) || 0); });
    /* Weeks in a row with points, counting back from this week (or last week, if this one has none yet). */
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    if (!weeks[weekKey(d)]) d.setDate(d.getDate() - 7);
    while (Number(weeks[weekKey(d)]) > 0) { streak++; d.setDate(d.getDate() - 7); }
    return { all: p.all, best: best, streak: streak };
  }

  /* ---------- Busiest Kitchen: the opt-in leaderboard (nicknames only) ---------- */
  var board = { rows: [], watching: false, myId: '', tab: 'week' };
  function boardCard() {
    var r = record(), w = weekPoints();
    var recordCard = '<section class="section paper"><h2>Your kitchen record</h2><p class="fine">Only you see this. Points come from effort, never from marks.</p>' +
      '<div class="record"><div><strong>' + w + '</strong><span>points this week · ' + rankOf(w) + '</span></div><div><strong>' + r.all + '</strong><span>points all time</span></div><div><strong>' + r.best + '</strong><span>best week</span></div><div><strong>' + r.streak + '</strong><span>week' + (r.streak === 1 ? '' : 's') + ' in a row</span></div></div>' +
      '<details class="earn-box"><summary>How to earn points</summary><table class="earn"><tbody>' +
      '<tr><td>Correct answer in More practice</td><td>+2</td></tr><tr><td>Homework question checked as correct (once a week each)</td><td>+3</td></tr><tr><td>Fixing a mistake in Review my mistakes</td><td>+3</td></tr><tr><td>Finishing a quiz or test with at least half answered (once a day each)</td><td>+5</td></tr>' +
      '</tbody></table><p class="fine">Wrong answers don’t lose points and don’t earn them. Chef ranks each week: ' + RANKS.map(function (x) { return x[0] + ' ' + x[1] + '+'; }).join(' · ') + '.</p></details></section>';
    if (!window.claude || STANDALONE) return recordCard;
    var joined = state.board;
    return recordCard + '<section class="section paper"><div class="board-head"><div><h2>Busiest Kitchen</h2><p class="fine" data-board-when></p></div>' +
      '<div class="tabs" role="tablist" aria-label="Which leaderboard"><button type="button" role="tab" data-act="board-tab" data-tab="week" aria-selected="' + (board.tab === 'week') + '">This week</button><button type="button" role="tab" data-act="board-tab" data-tab="all" aria-selected="' + (board.tab === 'all') + '">All time</button></div></div>' +
      '<p class="fine">Ranks effort, not marks. Only people who join appear, under a nickname.</p><div data-board></div>' +
      (joined ? '<div class="row"><button class="btn small quiet" data-act="board-leave">Leave the leaderboard</button></div>' :
      '<form data-form="board-join"><label class="lbl" for="board-nick">Choose a nickname (not your real name)</label><input class="math-in" id="board-nick" maxlength="20" autocomplete="off" required><p class="form-msg" data-msg role="status"></p><div class="row"><button class="btn small" type="submit">Join the leaderboard</button></div></form>') + '</section>';
  }
  function boardRows(tab) {
    var wk = weekKey();
    /* Nobody is listed with 0 points, except yourself once you've joined. */
    return board.rows.map(function (r) { return { id: r.id, nick: r.nick, p: tab === 'week' ? (r.week === wk ? r.wpts : 0) : r.all }; })
      .filter(function (r) { return r.p > 0 || (r.id === board.myId && state.board); })
      .sort(function (a, b) { return b.p - a.p || a.nick.localeCompare(b.nick); });
  }
  function drawBoard() {
    drawBoardAdmin();
    var box = view.querySelector('[data-board]');
    if (!box) return;
    var when = view.querySelector('[data-board-when]');
    if (when) when.textContent = board.tab === 'week' ? 'This week · Resets Monday morning' : 'All time';
    var list = boardRows(board.tab), top = list.length ? Math.max(1, list[0].p) : 1, scale = board.tab === 'week' ? 1 : 4;
    var mine = list.findIndex(function (r) { return r.id === board.myId && state.board; });
    var html = list.length ? '<ol class="board">' + list.slice(0, 10).map(function (r, i) {
      var rk = rankOf(r.p, scale), me = i === mine;
      return '<li' + (me ? ' class="me"' : '') + '><span class="place">' + (i + 1) + '</span><span class="who"><b>' + esc(r.nick) + (me ? ' <small>(you)</small>' : '') + '</b><span class="pbar"><i style="width:' + Math.max(4, r.p / top * 100) + '%"></i></span></span><span class="pts"><strong>' + r.p + '</strong><span class="badge' + (rk === 'Head Chef' ? ' head' : rk === 'Sous Chef' ? ' sous' : '') + '">' + rk + '</span></span></li>';
    }).join('') + '</ol>' : '<p>' + (board.rows.length ? 'Nobody has earned points ' + (board.tab === 'week' ? 'this week' : 'yet') + '. Be the first.' : 'Nobody has joined yet. Be the first.') + '</p>';
    if (mine >= 0) {
      var ahead = list[mine - 1];
      html += '<div class="you-row"><span><b>You’re ' + ordinal(mine + 1) + '</b> with ' + list[mine].p + ' points</span><span>' + (ahead ? (ahead.p - list[mine].p + 1) + ' points to ' + (mine < 10 ? 'pass ' + esc(ahead.nick) : 'move up to ' + ordinal(mine)) : 'Top of the kitchen!') + '</span></div>';
    }
    box.innerHTML = html;
  }
  function drawBoardAdmin() {
    var holder = view.querySelector('[data-board-admin]');
    if (!holder) return;
    var wk = weekKey();
    holder.innerHTML = board.rows.length ? '<ul class="lines">' + board.rows.map(function (r) { return '<li class="admin-row"><span>' + esc(r.nick) + ' · ' + (r.week === wk ? r.wpts : 0) + ' this week · ' + r.all + ' all time</span><div class="admin-actions"><button class="btn small quiet" data-act="staff-board-remove" data-id="' + esc(r.id) + '" aria-label="Remove ' + esc(r.nick) + '">Remove</button></div></li>'; }).join('') + '</ul>' : '<p>Nobody has joined yet.</p>';
  }
  function num(v) { return Math.max(0, Math.min(100000, Math.round(Number(v) || 0))); }
  async function startBoard() {
    if (STANDALONE) return; /* no leaderboard in the GitHub version */
    drawBoard();
    await staff.ready;
    if (!staff.db || board.watching) { drawBoard(); return; }
    board.watching = true;
    board.myId = staff.user ? await staff.user.id() : '';
    staff.db.collection('board').onSnapshot(function (snap) {
      board.rows = snap.docs.map(function (doc) { var d = doc.data() || {}; return { id: doc.id, nick: String(d.nick || 'Chef').slice(0, 20), week: String(d.week || ''), wpts: num(d.wpts), all: num(d.all) }; });
      drawBoard();
    }, function () { board.watching = false; });
  }
  async function leaveBoard() {
    try {
      await staff.db.doc('board/' + (board.myId || await staff.user.id())).delete();
      delete state.board;
      persist();
      sendProgress();
      route();
    } catch (e) { toast('That didn’t work. Try again.'); }
  }
  async function sendBoard() {
    if (!state.board || !board.myId && !(staff.user && (board.myId = await staff.user.id()))) return;
    var row = { nick: state.board.nick, week: weekKey(), wpts: weekPoints(), all: pts().all }, sig = JSON.stringify(row);
    if (state.board.sent === sig) return;
    row.updatedAt = Date.now();
    await staff.db.doc('board/' + board.myId).set(row);
    state.board.sent = sig;
    persist();
  }

  /* ---------- Staff ---------- */
  function pageStaff() {
    view.innerHTML = hero('Meet the instructors', 'Your teacher and student instructors', 'Two student instructors. Four connected calculus topics.', art('chef-wave', '', 'width="150" height="200"')) + '<section class="section">' + teamCards() + '</section>';
  }

  /* ---------- Shared staff content ----------
     Questions and videos live in the site's shared storage. Everyone signed in reads them;
     the platform only accepts writes from people with Editor access (see the publish rules).
     Without that storage (opened as a local file, or signed out) the built-in content shows. */
  var AREAS = { homework: 'Homework', quiz1: 'Quiz 1', quiz2: 'Quiz 2', test1: 'Test 1', test2: 'Test 2' };
  var STRANDS = ['Knowledge', 'Application', 'Thinking', 'Communication'];
  /* The four achievement-chart skills, shown as a K A T C strip with this question's skill lit up. */
  function strandOf(q) { return STRANDS.indexOf(q.strand) !== -1 ? q.strand : q.topic === 'rates' ? 'Application' : 'Knowledge'; }
  function katc(q) {
    var s = strandOf(q);
    return '<div class="katc" role="img" aria-label="Skill: ' + s + '">' + STRANDS.map(function (t) { return '<b' + (t === s ? ' class="on"' : '') + ' aria-hidden="true">' + t.charAt(0) + '</b>'; }).join('') + '<span aria-hidden="true">' + s + '</span></div>';
  }
  var BUILT_IN = { homework: COURSE.homework, quiz1: COURSE.quizzes.quiz1.questions, quiz2: COURSE.quizzes.quiz2.questions, test1: COURSE.tests.test1.questions, test2: COURSE.tests.test2.questions };
  var staffData = { questions: [], videos: {}, results: [], controls: {}, marks: {} };
  var staff = { db: null, user: null, ready: null };

  function strings(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x.trim(); }) : []; }
  function toQuestion(doc) {
    var d = doc.data() || {};
    if (!AREAS[d.area] || !TOPICS[d.topic] || !d.title || !d.prompt) return null;
    var kind = ['expr', 'mc', 'multi', 'explain'].indexOf(d.kind) === -1 ? 'multi' : d.kind;
    return {
      id: 's' + doc.id, docId: doc.id, staff: true, area: d.area, topic: d.topic, strand: STRANDS.indexOf(d.strand) === -1 ? 'Knowledge' : d.strand,
      title: String(d.title), prompt: String(d.prompt), tex: String(d.tex || ''), kind: kind, expected: String(d.expected || ''), choices: strings(d.choices), a: Number(d.a) || 0,
      hints: strings(d.hints), solution: strings(d.solution), keys: strings(d.keys), marks: qValue(d), createdAt: Number(d.createdAt) || 0,
      sample: d.sample && d.sample.work ? { who: String(d.sample.who || 'Sample student'), work: strings(d.sample.work), mark: String(d.sample.mark || ''), comment: String(d.sample.comment || '') } : null
    };
  }
  /* A staff question replaces the demonstrations: per quiz or test, and per topic for homework. */
  function applyStaffQuestions() {
    function mine(area) { return staffData.questions.filter(function (q) { return q.area === area; }); }
    ['quiz1', 'quiz2'].forEach(function (a) { var m = mine(a); COURSE.quizzes[a].questions = m.length ? m : BUILT_IN[a]; });
    ['test1', 'test2'].forEach(function (a) { var m = mine(a); COURSE.tests[a].questions = m.length ? m : BUILT_IN[a]; });
    var hw = mine('homework');
    COURSE.homework = BUILT_IN.homework.filter(function (q) { return !hw.some(function (h) { return h.topic === q.topic; }); }).concat(hw);
  }
  /* A redraw between pressing and releasing the mouse would swallow the click (for example: change a
     time limit, then click a tab straight away). So redraws wait until the press is over. */
  var pressing = false, redrawWaiting = false;
  document.addEventListener('pointerdown', function () { pressing = true; }, true);
  ['pointerup', 'pointercancel'].forEach(function (type) {
    document.addEventListener(type, function () {
      pressing = false;
      if (redrawWaiting) { redrawWaiting = false; setTimeout(staffChanged, 0); }
    }, true);
  });
  function staffChanged() {
    if (pressing) { redrawWaiting = true; return; }
    var page = parts()[0] || 'home';
    if (page === 'admin') { drawAdminLists(); drawControls(); drawPlans(); return; }
    if (page === 'results' || ((page === 'quizzes' || page === 'tests') && parts()[1])) return;
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.dataset.explore === undefined) return;
    var y = window.scrollY;
    renderPage();
    window.scrollTo(0, y);
  }
  function startStaffData() {
    var firstDataDone;
    staff.firstData = new Promise(function (resolve) { firstDataDone = resolve; });
    setTimeout(firstDataDone, 5000);
    staff.ready = (async function () {
      if (!window.claude) { firstDataDone(); return; }
      staff.db = await claude.use('db');
      staff.user = await claude.use('user');
      staffIsEditor = staff.user && !STANDALONE ? !!(await staff.user.canEdit()) : false;
      if (!staff.db) { firstDataDone(); return; }
      var waiting = 2;
      function oneArrived() { waiting--; if (waiting <= 0) firstDataDone(); }
      staff.db.collection('questions').orderBy('createdAt').onSnapshot(function (snap) {
        staffData.questions = snap.docs.map(toQuestion).filter(Boolean);
        applyStaffQuestions();
        applyControls();
        oneArrived();
        staffChanged();
      }, function () { oneArrived(); /* the built-in content stays on show */ });
      staff.db.collection('controls').onSnapshot(function (snap) {
        var controls = {};
        snap.docs.forEach(function (doc) { controls[doc.id] = doc.data() || {}; });
        staffData.controls = controls;
        applyControls();
        oneArrived();
        staffChanged();
      }, function () { oneArrived(); });
      staff.db.collection('videos').onSnapshot(function (snap) {
        var videos = {};
        snap.docs.forEach(function (doc) { videos[doc.id] = doc.data(); });
        staffData.videos = videos;
        staffChanged();
      }, function () { /* lessons show "not added yet" */ });
    })();
  }

  /* ---------- Staff admin page ---------- */
  var UNLOCK_KEY = 'steak-and-fries-staff';
  var unlockedHash = null;
  var editingId = null;
  function isUnlocked(hash) {
    if (unlockedHash === hash) return true;
    try { return sessionStorage.getItem(UNLOCK_KEY) === hash; } catch (e) { return false; }
  }
  function setUnlocked(hash) {
    unlockedHash = hash;
    try { if (hash) sessionStorage.setItem(UNLOCK_KEY, hash); else sessionStorage.removeItem(UNLOCK_KEY); } catch (e) { /* lasts until reload */ }
  }
  async function hashPassword(password, saltHex) {
    var enc = new TextEncoder();
    var salt = Uint8Array.from(saltHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
    var key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: 150000 }, key, 256);
    return Array.from(new Uint8Array(bits)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function newSalt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function adminShell(body) {
    view.innerHTML = hero('Staff only', 'Staff admin', 'Add questions and answers, and upload lesson videos.', art('chef-spatula', '', 'width="150" height="200"')) + '<div data-admin>' + body + '</div>';
  }
  function adminMessage(title, text) {
    adminShell('<section class="section paper"><h2>' + title + '</h2><p>' + text + '</p><div class="row"><a class="btn small quiet" href="#home">Back to the site</a></div></section>');
  }
  var pwDoc = null;
  async function pageAdmin() {
    var token = routeToken;
    adminMessage('Checking your access…', 'This takes a moment.');
    if (!window.claude) { adminMessage('Open the online version', 'Staff tools need the site’s shared storage, so they only work from the hosted link, not from the copy on this computer.'); return; }
    var slow = setTimeout(function () { if (token === routeToken) adminMessage('Can’t reach the site’s storage yet', 'Check your connection and sign in to Claude, then reload this page.'); }, 10000);
    await staff.ready;
    var canEdit = staff.user ? await staff.user.canEdit() : false;
    var isOwner = staff.user ? await staff.user.isOwner() : false;
    if (token !== routeToken) { clearTimeout(slow); return; }
    if (!staff.db || !canEdit) {
      clearTimeout(slow);
      adminMessage('This page is for staff', 'If you’re staff, ask the project owner to give you Editor access to this site, then reload this page.');
      return;
    }
    var snap;
    try { snap = await staff.db.doc('settings/admin').get(); } catch (e) { clearTimeout(slow); if (token === routeToken) adminMessage('Can’t reach the site’s storage yet', 'Reload this page in a moment.'); return; }
    clearTimeout(slow);
    if (token !== routeToken) return;
    pwDoc = snap.exists ? snap.data() : null;
    if (!pwDoc) {
      if (isOwner) drawCreatePassword(); else adminMessage('The staff password isn’t set yet', 'Ask the project owner to open this page first and create it.');
      return;
    }
    if (isUnlocked(pwDoc.hash)) drawAdmin(); else drawPasswordGate();
  }
  function passwordForm(title, text, act, label, confirmField) {
    adminShell('<section class="section paper narrow"><h2>' + title + '</h2><p>' + text + '</p><form data-form="' + act + '"><label class="lbl" for="pw-1">' + label + '</label><input class="math-in" id="pw-1" type="password" autocomplete="off" required>' +
      (confirmField ? '<label class="lbl" for="pw-2">Type it again</label><input class="math-in" id="pw-2" type="password" autocomplete="off" required>' : '') +
      '<p class="form-msg" data-msg role="status"></p><div class="row"><button class="btn" type="submit">Continue</button></div></form></section>');
    document.getElementById('pw-1').focus();
  }
  function drawCreatePassword() {
    passwordForm('Create the staff password', 'Choose a password of at least 8 characters and share it only with staff. It can’t be recovered, but you can change it later from this page.', 'pw-create', 'New password', true);
  }
  function drawPasswordGate() { passwordForm('Enter the staff password', 'You’ll stay signed in until you close this tab or press Lock.', 'pw-check', 'Staff password', false); }
  function setMsg(root, text, bad) {
    var m = root.querySelector('[data-msg]');
    if (m) { m.textContent = text; m.classList.toggle('bad', !!bad); }
  }
  async function savePassword(form, value, confirmValue) {
    if (value.length < 8) { setMsg(form, 'Use at least 8 characters.', true); return false; }
    if (value !== confirmValue) { setMsg(form, 'The two passwords don’t match.', true); return false; }
    var salt = newSalt(), hash = await hashPassword(value, salt);
    pwDoc = { salt: salt, hash: hash };
    await staff.db.doc('settings/admin').set(pwDoc);
    setUnlocked(hash);
    return true;
  }
  document.addEventListener('submit', async function (e) {
    var form = e.target, act = form.dataset.form;
    if (!act) return;
    e.preventDefault();
    if (act === 'ticket') { orderUp(); return; }
    var button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      if (act === 'board-join') {
        var nick = form.querySelector('#board-nick').value.trim();
        if (!nick) { setMsg(form, 'Choose a nickname first.', true); return; }
        state.board = { nick: nick };
        try { await sendBoard(); persist(); sendProgress(); route(); }
        catch (err) { delete state.board; setMsg(form, 'That didn’t save. Ask your teacher for Contributor access to this site.', true); }
      } else if (act === 'student-name') {
        var nm = form.querySelector('#st-name').value.trim(), cl = form.querySelector('#st-class').value.trim();
        if (!nm || !cl) { setMsg(form, 'Add your name and your class.', true); return; }
        state.profile = { name: nm, cls: cl };
        delete state.sentSig;
        editingName = false;
        scoreStatus = 'idle';
        persist();
        sendScores();
        route();
      } else if (act === 'pw-create') {
        if (await savePassword(form, form.querySelector('#pw-1').value, form.querySelector('#pw-2').value)) drawAdmin();
      } else if (act === 'pw-check') {
        var hash = await hashPassword(form.querySelector('#pw-1').value, pwDoc.salt);
        if (hash === pwDoc.hash) { setUnlocked(hash); drawAdmin(); }
        else { setMsg(form, 'That password isn’t right.', true); form.querySelector('#pw-1').select(); }
      } else if (act === 'pw-change') {
        if (await savePassword(form, form.querySelector('#pw-1').value, form.querySelector('#pw-2').value)) { form.reset(); setMsg(form, 'Password changed. Tell the other staff the new one.'); }
      } else if (act === 'question') {
        await saveQuestion(form);
      } else if (act === 'video-link') {
        await saveVideoLink(form);
      }
    } catch (err) {
      setMsg(form, err && err.code === 'quota_exceeded' ? 'The site’s storage is full. Delete something first, then try again.' : 'That couldn’t be saved. Check your connection and try again. What you typed is still here.', true);
    }
    if (button) button.disabled = false;
  });

  function drawAdmin() {
    editingId = null;
    adminShell('<div class="row"><button class="btn small quiet" data-act="staff-lock">Lock</button></div>' +
      '<section class="section paper"><h2>Quiz and test controls</h2><p class="fine">Changes save straight away. Closing one stops new attempts, and anyone already working can finish. Attempts allowed counts every submitted attempt, including ones before you set it. Hiding answers hides them in the page, but a tech-savvy student could still dig them out, so don’t reuse these questions in a real exam.</p><div data-controls></div></section>' +
      '<section class="section paper" id="bank"><h2>Questions</h2><p class="fine">Choose a section. Add, edit or delete its questions, and choose how many of each skill students get. <b>Objective</b> means multiple choice (A, B, C or D), marked by the site. <b>Subjective</b> means a worked answer or written explanation, marked against your answer and checked by you in Marking.</p>' +
      '<div class="bank-tabs" role="tablist" aria-label="Section" data-bank-tabs></div><div data-plans></div>' +
      '<div class="bank-list-head"><h3 data-bank-title>Questions</h3><button class="btn small" data-act="bank-add">+ Add a question</button></div>' +
      '<div class="bank-form" data-question-form hidden></div><div data-question-list></div></section>' +
      '<section class="section paper"><h2>Student scores</h2><p class="fine">' + (STANDALONE ? 'This version keeps everything on this device, so you see the scores of quizzes taken in this browser. ' : '') + 'Each cell shows the latest attempt, including your marks from Marking. Students send these from their own browser, so treat them as a guide and not as a secure exam record.</p><div data-results></div></section>' +
      '<section class="section paper"><h2>Marking</h2><p class="fine">The site marks every answer it can by comparing it with your answer. Check any attempt here and press <b>Correct</b> or <b>Not yet</b> to change a mark, for example when a student is right but wrote it in a way the site didn’t expect. Students see your marks the next time they open the site, and their score updates.</p><div data-marking></div></section>' +
      (STANDALONE ? '' : '<section class="section paper"><h2>Leaderboard</h2><p class="fine">Remove any nickname that isn’t appropriate.</p><div data-board-admin></div></section>') +
      '<section class="section paper"><h2>Lesson videos</h2><p class="fine">' + (STANDALONE ? 'To show a video on its lesson page, upload the video file to the GitHub repository with the name shown below. It plays inside the page. Files must be MP4 and under 25 MB. Or paste a link here instead, such as YouTube; a saved link replaces the file.' : 'Upload a video of up to 20 MB, or paste a link if the file is bigger. A link opens in a new tab.') + '</p><div data-video-list></div></section>' +
      '<section class="section paper narrow"><h2>Change the staff password</h2><form data-form="pw-change"><label class="lbl" for="pw-1">New password</label><input class="math-in" id="pw-1" type="password" autocomplete="new-password" required><label class="lbl" for="pw-2">Type it again</label><input class="math-in" id="pw-2" type="password" autocomplete="new-password" required><p class="form-msg" data-msg role="status"></p><div class="row"><button class="btn small" type="submit">Change password</button></div></form></section>');
    closeQuestionForm();
    drawAdminLists();
    drawControls();
    drawPlans();
    startResults();
    startBoard();
  }
  function startResults() {
    drawResults();
    if (staff.resultsWatching) return;
    staff.resultsWatching = true;
    staff.db.collection('results').onSnapshot(function (snap) {
      staffData.results = snap.docs.map(function (doc) { return { id: doc.id, data: doc.data() || {} }; });
      drawResults();
      drawMarking();
    }, function () { staff.resultsWatching = false; });
    staff.db.collection('marks').onSnapshot(function (snap) {
      var all = {};
      snap.docs.forEach(function (doc) { var d = doc.data() || {}; all[doc.id] = { m: d.m && typeof d.m === 'object' ? d.m : {}, c: d.c && typeof d.c === 'object' ? d.c : {} }; });
      staffData.marks = all;
      drawMarking();
      drawResults();
    }, function () { /* marking still shows the site's marks */ });
  }

  /* ---------- Marking: staff check the site's marks and change any of them ----------
     Students send their latest two attempts at each quiz and test with their answers (see answerDetails).
     Everything in them came from a student's browser, so it is escaped, and question text comes
     from the site's own bank where the question still exists. */
  var marking = { open: '', show: 'waiting' };
  function bankQuestion(key, id) {
    return staffData.questions.find(function (q) { return q.area === key && q.id === id; }) || (BUILT_IN[key] || []).find(function (q) { return q.id === id; }) || null;
  }
  function teacherDoc(sid) { return (staffData.marks || {})[sid] || { m: {}, c: {} }; }
  function teacherMap(sid) { return teacherDoc(sid).m; }
  function teacherNotes(sid) { return teacherDoc(sid).c; }
  function attemptsToMark() {
    var out = [];
    staffData.results.forEach(function (r) {
      var det = r.data.details;
      if (!det || typeof det !== 'object') return;
      Object.keys(det).forEach(function (k) {
        var d = det[k];
        if (!d || !Array.isArray(d.q) || !AREAS[d.key] || d.key === 'homework') return;
        var tm = teacherMap(r.id), score = 0, total = 0, waiting = 0, at = Number(d.at) || 0;
        d.q.forEach(function (row, i) {
          var t = tm[at + ':' + i], m = validMark(t) ? t : row && row.m, v = qValue({ marks: row && row.v });
          total += v;
          if (validMark(m)) score += m * v; else waiting++;
        });
        out.push({ sid: r.id, name: String(r.data.name || 'Student'), cls: String(r.data.cls || ''), key: d.key, at: at, q: d.q, score: halves(score), total: total, waiting: waiting });
      });
    });
    return out.sort(function (a, b) { return (b.waiting > 0) - (a.waiting > 0) || b.at - a.at; });
  }
  function drawMarking() {
    var holder = view.querySelector('[data-marking]');
    if (!holder) return;
    /* Never redraw under someone typing a comment. */
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA' && holder.contains(document.activeElement)) return;
    var all = attemptsToMark(), waiting = all.filter(function (x) { return x.waiting; });
    /* The attempt being reviewed stays in view after its last answer is marked, so a comment can still be added. */
    var list = marking.show === 'waiting' ? all.filter(function (x) { return x.waiting || x.sid + '@' + x.at === marking.open; }) : all;
    var tabs = '<div class="tabs" role="tablist" aria-label="Which attempts"><button type="button" role="tab" data-act="mark-show" data-show="waiting" aria-selected="' + (marking.show === 'waiting') + '">Waiting for you (' + waiting.length + ')</button><button type="button" role="tab" data-act="mark-show" data-show="all" aria-selected="' + (marking.show === 'all') + '">All attempts (' + all.length + ')</button></div>';
    if (!list.length) { holder.innerHTML = tabs + '<p style="margin-top:10px">' + (all.length ? 'Nothing is waiting. Open <b>All attempts</b> to check or change any mark.' : 'No attempts yet. They appear here when a student adds their name on the order ticket and submits a quiz or test.') + '</p>'; return; }
    holder.innerHTML = tabs + '<ul class="mark-list">' + list.map(function (x) {
      var id = x.sid + '@' + x.at, open = marking.open === id;
      return '<li class="mark-item' + (open ? ' open' : '') + '"><div class="mark-row"><span><b>' + esc(x.name) + '</b>' + (x.cls ? ' · ' + esc(x.cls) : '') + '<br><small>' + AREAS[x.key] + ' · ' + new Date(x.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + '</small></span>' +
        '<span class="mark-score"><b>' + fmtMarks(x.score) + ' / ' + x.total + '</b>' + (x.waiting ? '<small class="chip-wait">' + x.waiting + ' waiting</small>' : '<small class="chip-done">All marked</small>') + '</span>' +
        '<button class="btn small' + (open ? ' quiet' : '') + '" data-act="mark-open" data-id="' + esc(id) + '" aria-expanded="' + open + '">' + (open ? 'Close' : 'Review') + '</button></div>' + (open ? reviewHtml(x) : '') + '</li>';
    }).join('') + '</ul>';
  }
  function reviewHtml(x) {
    var tm = teacherMap(x.sid), notes = teacherNotes(x.sid);
    return '<div class="mark-review">' + x.q.map(function (row, i) {
      row = row || {};
      var q = bankQuestion(x.key, row.id), key = x.at + ':' + i, t = tm[key], site = row.m === 1 || row.m === 0 ? row.m : null, now = validMark(t) ? t : site;
      var v = qValue({ marks: row.v }), changedByYou = validMark(t);
      var kind = q ? q.kind : row.k, yours;
      if (kind === 'mc') {
        var pick = Number(row.pick);
        yours = row.pick === undefined ? 'No answer' : LETTERS[pick] ? LETTERS[pick] + (q && q.choices[pick] ? ': ' + tex(q.choices[pick]) : '') : 'No answer';
      } else yours = row.ans ? '<span class="typed">' + esc(row.ans) + '</span>' : 'No typed answer';
      var key2 = q ? (q.kind === 'mc' ? '<p><b>Correct choice:</b> ' + LETTERS[q.a] + ': ' + tex(q.choices[q.a]) + '</p>' : '') +
        (q.kind === 'multi' && q.expected ? '<p><b>Your answer:</b> ' + esc(q.expected) + '</p>' : '') +
        (q.kind === 'explain' && q.keys && q.keys.length ? '<p><b>Key words:</b> ' + q.keys.map(esc).join(', ') + '</p>' : '') +
        '<details class="note"><summary>Worked solution</summary>' + q.solution.map(rich).join('<br>') + '</details>' : '<p class="fine">This question has since been deleted, so its answer isn’t shown.</p>';
      var siteText = site === 1 ? 'The site marked it correct' : site === 0 ? 'The site marked it not yet' : 'The site couldn’t mark this one';
      /* Mark buttons: Not yet, ½ and Correct for a 1-mark question; 0 to the full value otherwise. */
      var steps = v === 1 ? [[0, '✗ Not yet'], [.5, '½ Half'], [1, '✓ Correct']] : Array.apply(null, Array(v + 1)).map(function (_, p) { return [p / v, p + (p === v ? ' ✓' : '')]; });
      var buttons = steps.map(function (st) {
        var on = validMark(now) && Math.abs(now - st[0]) < .001;
        return '<button class="btn small' + (on ? (st[0] === 0 ? ' no-on' : '') : ' quiet') + '" data-act="teacher-mark" data-sid="' + esc(x.sid) + '" data-key="' + key + '" data-v="' + st[0] + '" aria-pressed="' + on + '"' + (v > 1 ? ' aria-label="' + Math.round(st[0] * v) + ' out of ' + v + '"' : '') + '>' + st[1] + '</button>';
      }).join('');
      return '<article class="mq">' + katc({ strand: row.s, topic: q ? q.topic : '' }) + '<h4>' + (i + 1) + '. ' + esc(q ? q.title : row.t || 'Question') + ' <small class="worth">' + v + ' mark' + (v === 1 ? '' : 's') + '</small></h4>' + (q ? formula(q) : '') +
        '<div class="mq-grid"><div><p><b>Student’s answer:</b> ' + yours + '</p>' + (row.sk ? sketchSvg(row.sk) : '') + (row.skGone ? '<p class="fine">The drawing was too big to send.</p>' : '') + '</div><div>' + key2 + '</div></div>' +
        '<div class="mq-mark"><span class="fine">' + siteText + (changedByYou ? '. You gave ' + fmtMarks(t * v) + ' out of ' + v + '.' : '.') + '</span><div class="row" role="group" aria-label="Mark">' + buttons +
        (changedByYou ? '<button class="btn small quiet" data-act="teacher-mark" data-sid="' + esc(x.sid) + '" data-key="' + key + '" data-v="">Use the site’s mark</button>' : '') + '</div></div>' +
        '<label class="lbl" for="note-' + esc(x.sid) + '-' + key.replace(':', '-') + '">Comment for the student (optional)</label><textarea class="work note-in" id="note-' + esc(x.sid) + '-' + key.replace(':', '-') + '" maxlength="600" data-note-sid="' + esc(x.sid) + '" data-note-key="' + key + '" placeholder="For example: Good working. Check the sign in step 2.">' + esc(notes[key] || '') + '</textarea><p class="fine">Saves when you click away. The student sees it beside this question.</p></article>';
    }).join('') + '</div>';
  }
  async function saveTeacherDoc(sid, next, done) {
    var before = teacherDoc(sid);
    staffData.marks = staffData.marks || {};
    staffData.marks[sid] = next;
    var y = window.scrollY;
    drawMarking();
    window.scrollTo(0, y);
    try { await staff.db.doc('marks/' + sid).set({ m: next.m, c: next.c, updatedAt: Date.now() }); if (done) toast(done); }
    catch (e) { staffData.marks[sid] = before; drawMarking(); toast('That couldn’t be saved. Try again.'); }
  }
  function setTeacherMark(sid, key, v) {
    var doc = teacherDoc(sid), m = Object.assign({}, doc.m);
    if (v === '') delete m[key]; else m[key] = Math.max(0, Math.min(1, Number(v)));
    saveTeacherDoc(sid, { m: m, c: doc.c });
  }
  function setTeacherNote(sid, key, text) {
    var doc = teacherDoc(sid), c = Object.assign({}, doc.c);
    text = text.trim().slice(0, 600);
    if ((c[key] || '') === text) return;
    if (text) c[key] = text; else delete c[key];
    saveTeacherDoc(sid, { m: doc.m, c: c }, text ? 'Comment saved.' : 'Comment removed.');
  }
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.noteSid) { el.blur(); setTeacherNote(el.dataset.noteSid, el.dataset.noteKey, el.value); }
  });
  /* Marks by skill for a student's latest attempt at one quiz or test, with the teacher's marks applied.
     Comes from the answers the student sent (see answerDetails). null when there are none. */
  var scoreView = 'totals';
  function skillMarks(r, key) {
    var det = r.data.details, best = null;
    if (det && typeof det === 'object') Object.keys(det).forEach(function (k) { var d = det[k]; if (d && d.key === key && Array.isArray(d.q) && (!best || Number(d.at) > Number(best.at))) best = d; });
    if (!best) return null;
    var tm = teacherMap(r.id), out = { got: 0, total: 0, waiting: 0, by: {} };
    STRANDS.forEach(function (t) { out.by[t] = [0, 0]; });
    best.q.forEach(function (row, i) {
      row = row || {};
      var t = tm[Number(best.at) + ':' + i], m = validMark(t) ? t : row.m, v = qValue({ marks: row.v }), st = STRANDS.indexOf(row.s) === -1 ? 'Knowledge' : row.s;
      out.total += v; out.by[st][1] += v;
      if (validMark(m)) { out.got += m * v; out.by[st][0] += m * v; } else out.waiting++;
    });
    return out;
  }
  function sortedResults() {
    return staffData.results.slice().sort(function (a, b) { return String(a.data.cls).localeCompare(String(b.data.cls)) || String(a.data.name).localeCompare(String(b.data.name)); });
  }
  var SCORE_IDS = ['quiz1', 'quiz2', 'test1', 'test2'];
  function drawResults() {
    var holder = view.querySelector('[data-results]');
    if (!holder) return;
    var rows = sortedResults();
    if (!rows.length) { holder.innerHTML = '<p>No student scores yet. They appear here when ' + (STANDALONE ? 'someone adds their name on the order ticket and finishes a quiz or test on this device.' : 'a student with Contributor access adds their name and finishes some work.') + '</p>'; return; }
    var ids = SCORE_IDS;
    var bar = '<div class="score-bar"><div class="tabs" role="tablist" aria-label="Which scores"><button type="button" role="tab" data-act="score-view" data-view="totals" aria-selected="' + (scoreView === 'totals') + '">Totals</button><button type="button" role="tab" data-act="score-view" data-view="skills" aria-selected="' + (scoreView === 'skills') + '">By skill (KATC)</button></div><button class="btn small quiet" data-act="scores-csv">Download scores (.csv)</button></div>';
    function cell(r, key) {
      var d = r.data, list = (Array.isArray(d.attempts) ? d.attempts : []).filter(function (a) { return a && a.key === key; });
      if (!list.length) return '<td class="muted">–</td>';
      var last = list[list.length - 1], sk = skillMarks(r, key), unmarked = sk ? sk.waiting : Number(last.unmarked) || 0;
      if (scoreView === 'skills') {
        if (!sk) return '<td class="muted">No detail</td>';
        return '<td class="sk-cell">' + STRANDS.map(function (t) {
          var g = sk.by[t];
          return g[1] ? '<span class="sk' + (g[0] / g[1] < .5 ? ' low' : '') + '"><b>' + t.charAt(0) + '</b> ' + fmtMarks(g[0]) + '/' + g[1] + '</span>' : '<span class="sk none"><b>' + t.charAt(0) + '</b> –</span>';
        }).join('') + '</td>';
      }
      return '<td><b>' + (sk ? fmtMarks(sk.got) + '/' + sk.total : (Number(last.score) || 0) + '/' + (Number(last.total) || 0)) + '</b>' + (unmarked ? '<small>' + unmarked + ' unmarked</small>' : '') + (list.length > 1 ? '<small>' + list.length + ' tries</small>' : '') + '</td>';
    }
    var foot = '';
    if (scoreView === 'skills') {
      foot = '<tr class="avg"><th scope="row">Class average</th><td></td>' + ids.map(function (key) {
        var sum = {}, any = false;
        STRANDS.forEach(function (t) { sum[t] = [0, 0]; });
        rows.forEach(function (r) { var sk = skillMarks(r, key); if (sk) { any = true; STRANDS.forEach(function (t) { sum[t][0] += sk.by[t][0]; sum[t][1] += sk.by[t][1]; }); } });
        return any ? '<td class="sk-cell">' + STRANDS.map(function (t) { var g = sum[t]; return g[1] ? '<span class="sk' + (g[0] / g[1] < .5 ? ' low' : '') + '"><b>' + t.charAt(0) + '</b> ' + Math.round(g[0] / g[1] * 100) + '%</span>' : '<span class="sk none"><b>' + t.charAt(0) + '</b> –</span>'; }).join('') + '</td>' : '<td class="muted">–</td>';
      }).join('') + '<td></td><td></td></tr>';
    }
    holder.innerHTML = bar + (scoreView === 'skills' ? '<p class="fine">Marks for Knowledge, Application, Thinking and Communication in each student’s latest attempt, with your marks from Marking included. Red means under half.</p>' : '') +
      '<div class="results-wrap"><table class="results"><thead><tr><th scope="col">Student</th><th scope="col">Class</th>' + (scoreView === 'totals' ? '<th scope="col">Doneness</th><th scope="col">Homework</th>' : '') + ids.map(function (k) { return '<th scope="col">' + AREAS[k] + '</th>'; }).join('') + '<th scope="col">Last active</th><th scope="col"><span class="skip-label">Remove</span></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var d = r.data, pct = Math.max(0, Math.min(100, Number(d.pct) || 0)), when = Number(d.updatedAt);
        return '<tr><th scope="row">' + esc(d.name || 'No name') + '</th><td>' + esc(d.cls || '–') + '</td>' + (scoreView === 'totals' ? '<td>' + LEVELS[levelIndex(pct)][0] + '<small>' + pct + '%</small></td><td>' + (Number(d.homework) || 0) + '/' + (Number(d.homeworkTotal) || 0) + '</td>' : '') + ids.map(function (k) { return cell(r, k); }).join('') +
          '<td>' + (when ? new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '–') + '</td><td><button class="btn small quiet" data-act="staff-result-remove" data-id="' + esc(r.id) + '" aria-label="Remove ' + esc(d.name || 'this student') + '">Remove</button></td></tr>';
      }).join('') + foot + '</tbody></table></div>';
  }
  /* The scores as a spreadsheet file. Names come from students, so a cell that would start a formula gets a leading apostrophe. */
  function scoresCsv() {
    function cellText(v) {
      v = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(v) && isNaN(Number(v))) v = "'" + v;
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    var head = ['Name', 'Class', 'Doneness %', 'Homework done', 'Homework total'];
    SCORE_IDS.forEach(function (k) {
      var a = AREAS[k];
      head.push(a + ' score', a + ' out of');
      STRANDS.forEach(function (t) { head.push(a + ' ' + t.charAt(0), a + ' ' + t.charAt(0) + ' out of'); });
      head.push(a + ' attempts', a + ' waiting for marking');
    });
    var lines = [head];
    sortedResults().forEach(function (r) {
      var d = r.data, line = [d.name || '', d.cls || '', Math.max(0, Math.min(100, Number(d.pct) || 0)), Number(d.homework) || 0, Number(d.homeworkTotal) || 0];
      SCORE_IDS.forEach(function (k) {
        var list = (Array.isArray(d.attempts) ? d.attempts : []).filter(function (a) { return a && a.key === k; }), last = list[list.length - 1], sk = skillMarks(r, k);
        if (!last) { for (var n = 0; n < 12; n++) line.push(''); return; }
        line.push(sk ? halves(sk.got) : Number(last.score) || 0, sk ? sk.total : Number(last.total) || 0);
        STRANDS.forEach(function (t) { line.push(sk ? halves(sk.by[t][0]) : '', sk ? sk.by[t][1] : ''); });
        line.push(list.length, sk ? sk.waiting : Number(last.unmarked) || 0);
      });
      lines.push(line);
    });
    return '\ufeff' + lines.map(function (l) { return l.map(cellText).join(','); }).join('\r\n') + '\r\n';
  }
  async function downloadScores() {
    if (!staffData.results.length) { toast('There are no scores to download yet.'); return; }
    var csv = scoresCsv(), name = 'steak-and-fries-scores-' + new Date().toISOString().slice(0, 10) + '.csv';
    function copyBox() {
      dialog('Copy the scores', 'This view can’t save files, so here are the scores as text. Copy it and paste it into a spreadsheet.', '<button class="btn" data-act="close">Close</button>');
      var ta = document.createElement('textarea');
      ta.className = 'work'; ta.readOnly = true; ta.value = csv.replace('\ufeff', ''); ta.setAttribute('aria-label', 'Scores as comma-separated text');
      var d = modal.querySelector('.dialog'); d.insertBefore(ta, d.querySelector('.row')); ta.focus(); ta.select();
    }
    var dl = null;
    try { dl = window.claude ? await claude.use('downloads') : null; } catch (e) { dl = null; }
    if (!dl) { copyBox(); return; }
    try { await dl.save({ filename: name, data: csv }); toast('Scores saved.'); }
    catch (e) {
      var code = e && e.code;
      if (code === 'declined') return;
      if (code === 'rate_limited') { toast('A save is already waiting. Try again in a moment.'); return; }
      copyBox();
    }
  }
  function options(map, selected) {
    return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join('');
  }
  function drawQuestionForm(q) {
    var holder = view.querySelector('[data-question-form]');
    if (!holder) return;
    var v = q || { area: bank.tab, topic: 'product', strand: 'Knowledge', kind: bank.tab === 'homework' ? 'expr' : 'mc', title: '', prompt: '', tex: '', expected: '', choices: [], a: 0, hints: [], solution: [], keys: [] };
    var topicMap = {}; TOPIC_ORDER.forEach(function (t) { topicMap[t] = TOPICS[t].title; });
    var strandMap = {}; STRANDS.forEach(function (t) { strandMap[t] = t; });
    holder.innerHTML = '<h3>' + (q ? 'Edit question' : 'Add a question to ' + AREAS[v.area]) + '</h3><form data-form="question"><input type="hidden" id="q-area" value="' + v.area + '"><div class="form-grid">' +
      '<div><label class="lbl" for="q-topic">Topic</label><select class="math-in" id="q-topic">' + options(topicMap, v.topic) + '</select></div>' +
      '<div data-strand><label class="lbl" for="q-strand">Skill</label><select class="math-in" id="q-strand">' + options(strandMap, v.strand) + '</select></div>' +
      '<div><label class="lbl" for="q-marks">Marks</label><input class="math-in num-in" id="q-marks" type="number" min="1" max="10" value="' + qValue(v) + '"></div></div>' +
      '<label class="lbl" for="q-title">Label (only staff see this)</label><input class="math-in" id="q-title" maxlength="120" value="' + esc(v.title) + '" placeholder="For example: Q7(a) Product of a polynomial and sine">' +
      '<label class="lbl" for="q-prompt">Question</label><textarea class="work" id="q-prompt" placeholder="What should the student do?">' + esc(v.prompt) + '</textarea>' +
      '<label class="lbl" for="q-tex">Formula (optional, written in LaTeX)</label><input class="math-in" id="q-tex" spellcheck="false" value="' + esc(v.tex) + '" placeholder="f(x)=x^2\\sin x"><div class="q-math" id="q-tex-preview">' + (v.tex ? tex(v.tex, true) : '') + '</div>' +
      '<label class="lbl" for="q-kind">How it’s answered</label><select class="math-in" id="q-kind">' + options(kindOptions(v.area), v.kind) + '</select>' +
      '<div data-kind="expr"><label class="lbl" for="q-expected">Correct answer</label><input class="math-in" id="q-expected" spellcheck="false" value="' + esc(v.expected) + '" placeholder="6x^2 - 2x + 6"><p class="fine">Use plain maths like 3x^2 + cos(x) or 1/(x+1)^2. Students’ answers in any equivalent form are accepted.</p></div>' +
      '<div data-kind="multi"><label class="lbl" for="q-answer">Your answer (optional)</label><input class="math-in" id="q-answer" spellcheck="false" value="' + esc(v.kind === 'multi' ? v.expected : '') + '" placeholder="12x - 2"><p class="fine">The site compares each student’s typed answer with this and marks it, including equivalent forms. Leave it blank to mark every answer yourself. You can change any mark later.</p></div>' +
      '<div data-kind="explain"><label class="lbl" for="q-keys">Key words the explanation should use (optional)</label><input class="math-in" id="q-keys" value="' + esc((v.keys || []).join(', ')) + '" placeholder="radians, power rule"><p class="fine">Separate them with commas. The site marks the explanation correct when it uses all of them. Leave it blank to mark every answer yourself. You can change any mark later.</p></div>' +
      '<div data-kind="mc"><span class="lbl">Choices (LaTeX allowed). Select the correct one.</span>' + LETTERS.map(function (L, i) {
        return '<div class="choice-row"><input type="radio" name="q-correct" id="q-correct-' + i + '" value="' + i + '"' + (v.a === i ? ' checked' : '') + ' aria-label="' + L + ' is correct"><label for="q-correct-' + i + '" class="coin small-coin">' + L + '</label><input class="math-in" data-choice="' + i + '" aria-label="Choice ' + L + '" value="' + esc(v.choices[i]) + '"></div>';
      }).join('') + '</div>' +
      '<label class="lbl" for="q-hint1">Hint 1 (optional)</label><input class="math-in" id="q-hint1" value="' + esc(v.hints[0]) + '"><label class="lbl" for="q-hint2">Hint 2 (optional)</label><input class="math-in" id="q-hint2" value="' + esc(v.hints[1]) + '">' +
      '<label class="lbl" for="q-solution">Worked solution (one step per line; put maths between dollar signs)</label><textarea class="work" id="q-solution" placeholder="Let $f=x^2$ and $g=\\sin x$.">' + esc(v.solution.join('\n')) + '</textarea>' +
      '<p class="form-msg" data-msg role="status"></p><div class="row"><button class="btn" type="submit">' + (q ? 'Save changes' : 'Add question') + '</button>' + '<button class="btn quiet" type="button" data-act="staff-cancel">Cancel</button>' + '</div></form>';
    syncQuestionForm();
  }
  /* Quizzes and tests: objective is multiple choice only. Homework also keeps the typed answer the site checks. */
  function kindOptions(area) {
    var o = { mc: 'Objective · Multiple choice: A, B, C or D', multi: 'Subjective · Worked answer, checked against the solution', explain: 'Subjective · Written explanation, checked against the solution' };
    if (area === 'homework') o = Object.assign({ expr: 'Typed answer, checked automatically' }, o);
    return o;
  }
  function syncQuestionForm() {
    var kind = document.getElementById('q-kind'), area = document.getElementById('q-area');
    if (!kind) return;
    var allowed = kindOptions(area.value), keep = allowed[kind.value] ? kind.value : 'mc';
    if (kind.options.length !== Object.keys(allowed).length) kind.innerHTML = options(allowed, keep);
    view.querySelectorAll('[data-kind]').forEach(function (el) { el.hidden = el.dataset.kind !== kind.value; });
  }
  /* A made-up student answer, marked by the teacher, shown under the worked solution of a few questions. */
  function sampleCard(q) {
    if (!q.sample) return '';
    return '<div class="sample"><span class="sample-tag">Sample student answer</span> <small>' + esc(q.sample.who) + ' (made up for demonstration)</small>' +
      '<div class="sample-work">' + q.sample.work.map(rich).join('<br>') + '</div>' +
      '<div class="teacher-note sample-note"><b>' + esc(q.sample.mark) + '</b> · Teacher comment: ' + rich(q.sample.comment) + '</div></div>';
  }
  function fieldValue(id) { return document.getElementById(id).value.trim(); }
  async function saveQuestion(form) {
    var kind = fieldValue('q-kind');
    var body = {
      area: fieldValue('q-area'), topic: fieldValue('q-topic'), strand: fieldValue('q-strand'), kind: kind, marks: qValue({ marks: fieldValue('q-marks') }),
      title: fieldValue('q-title'), prompt: fieldValue('q-prompt'), tex: fieldValue('q-tex'), expected: '', choices: [], a: 0,
      hints: [fieldValue('q-hint1'), fieldValue('q-hint2')].filter(Boolean),
      solution: document.getElementById('q-solution').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
    };
    if (!body.title || !body.prompt) { setMsg(form, 'Add a title and the question.', true); return; }
    if (kind === 'multi') {
      body.expected = fieldValue('q-answer');
      if (body.expected && sameExpression(body.expected, body.expected) !== true) { setMsg(form, 'Your answer can’t be read. Use a form like 12x - 2, or leave it blank.', true); return; }
    }
    if (kind === 'explain') body.keys = fieldValue('q-keys').split(',').map(function (k) { return k.trim(); }).filter(Boolean).slice(0, 12);
    if (kind === 'expr' && body.area !== 'homework') { setMsg(form, 'Quizzes and tests use multiple choice for objective questions.', true); return; }
    if (kind === 'expr') {
      body.expected = fieldValue('q-expected');
      if (!body.expected || sameExpression(body.expected, body.expected) !== true) { setMsg(form, 'The correct answer can’t be read. Use a form like 3x^2 + cos(x).', true); return; }
    }
    if (kind === 'mc') {
      body.choices = Array.prototype.map.call(form.querySelectorAll('[data-choice]'), function (i) { return i.value.trim(); });
      var picked = form.querySelector('[name="q-correct"]:checked');
      if (body.choices.some(function (c) { return !c; })) { setMsg(form, 'Fill in all four choices.', true); return; }
      if (new Set(body.choices).size < 4) { setMsg(form, 'Each choice needs to be different.', true); return; }
      if (!picked) { setMsg(form, 'Select the correct choice.', true); return; }
      body.a = Number(picked.value);
    }
    if (!body.solution.length) { setMsg(form, 'Add the answer as a worked solution, so students can check their work.', true); return; }
    var existing = editingId && staffData.questions.find(function (q) { return q.docId === editingId; });
    body.createdAt = existing ? existing.createdAt : Date.now();
    if (existing && existing.sample) body.sample = existing.sample;
    var ref = editingId ? staff.db.doc('questions/' + editingId) : staff.db.collection('questions').doc();
    await ref.set(body);
    var wasEditing = !!editingId;
    closeQuestionForm();
    toast(wasEditing ? 'Changes saved.' : 'Question added to ' + AREAS[body.area] + '. Students can see it now.');
    var listTop = view.querySelector('[data-question-list]');
    if (listTop) listTop.scrollIntoView({ block: 'center' });
  }
  /* ---------- Staff: the Questions section, one tab per section ---------- */
  var bank = { tab: 'quiz1' };
  function sortedBank(list) {
    return list.slice().sort(function (a, b) { return STRANDS.indexOf(strandOf(a)) - STRANDS.indexOf(strandOf(b)) || (isObjective(b) - isObjective(a)) || (a.createdAt || 0) - (b.createdAt || 0); });
  }
  function drawBankTabs() {
    var holder = view.querySelector('[data-bank-tabs]');
    if (!holder) return;
    holder.innerHTML = Object.keys(AREAS).map(function (k) {
      var n = staffData.questions.filter(function (q) { return q.area === k; }).length;
      return '<button type="button" role="tab" class="bank-tab" data-act="bank-tab" data-tab="' + k + '" aria-selected="' + (bank.tab === k) + '">' + AREAS[k] + '<small>' + (n ? n + ' yours' : 'demos') + '</small></button>';
    }).join('');
  }
  function closeQuestionForm() {
    editingId = null;
    var holder = view.querySelector('[data-question-form]');
    if (holder) { holder.hidden = true; holder.innerHTML = ''; }
    var add = view.querySelector('[data-act="bank-add"]');
    if (add) add.hidden = false;
  }
  function openQuestionForm(q) {
    var holder = view.querySelector('[data-question-form]');
    if (!holder) return;
    holder.hidden = false;
    var add = view.querySelector('[data-act="bank-add"]');
    if (add) add.hidden = true;
    drawQuestionForm(q);
    holder.scrollIntoView({ block: 'start' });
    var first = holder.querySelector('#q-title');
    if (first) first.focus({ preventScroll: true });
  }
  function drawBank() { drawAdminLists(); drawPlans(); }
  /* The bank as a KATC blueprint: a row per skill, a column per topic, a button per question. */
  var SECTION_TOPICS = { quiz1: ['product', 'quotient'], test1: ['product', 'quotient'], quiz2: ['derivatives', 'rates'], test2: ['derivatives', 'rates'], homework: TOPIC_ORDER };
  var STRAND_NOTE = { Knowledge: 'Direct procedural execution', Application: 'Tangents, normals, local extrema', Thinking: 'Multi-step proofs, implicit synthesis', Communication: 'Rigorous deductive reasoning and proofs' };
  function shortLabel(q) {
    var t = String(q.title || ''), m = t.match(/^([A-Z][a-z]{2}\d{2}-)?Q\d+(\([a-z]\))?/), demo = t.match(/^Demonstration (\d+)/);
    return m ? m[0] : demo ? 'Demo ' + demo[1] : t.slice(0, 18) + (t.length > 18 ? '…' : '');
  }
  function bankKey(q) { return q.docId || q.area + ':' + q.id; }
  function blueprintHtml(area, list, demo) {
    var topics = (SECTION_TOPICS[area] || TOPIC_ORDER).slice();
    list.forEach(function (q) { if (topics.indexOf(q.topic) === -1) topics.push(q.topic); });
    return '<div class="results-wrap"><table class="blueprint' + (demo ? ' demo' : '') + '"><thead><tr><th scope="col">Category (KATC)</th>' + topics.map(function (t) { return '<th scope="col">' + esc(TOPICS[t].title) + ' questions</th>'; }).join('') + '</tr></thead><tbody>' +
      STRANDS.map(function (st) {
        var inRow = list.filter(function (q) { return strandOf(q) === st; });
        return '<tr><th scope="row"><b>' + st + ' (' + st.charAt(0) + ')</b><small>' + STRAND_NOTE[st] + '</small><small class="count">' + inRow.length + ' question' + (inRow.length === 1 ? '' : 's') + '</small></th>' + topics.map(function (t) {
          var cell = inRow.filter(function (q) { return q.topic === t; });
          return '<td>' + (cell.length ? cell.map(function (q) {
            var key = bankKey(q), on = bank.sel === key;
            return '<button type="button" class="qchip' + (isObjective(q) ? ' obj' : '') + (on ? ' on' : '') + '" data-act="bank-pick" data-key="' + esc(key) + '" aria-pressed="' + on + '" title="' + esc(q.title) + '">' + esc(shortLabel(q)) + (isObjective(q) ? '<small>A–D</small>' : '') + '</button>';
          }).join('') : '<span class="muted">–</span>') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="fine blueprint-key"><span class="qchip obj sample">Q1<small>A–D</small></span> objective, multiple choice &nbsp; <span class="qchip sample">Q1</span> subjective &nbsp; Click a question to see it, edit it or delete it.</p>';
  }
  function bankDetailHtml(list, demo) {
    var q = list.find(function (x) { return bankKey(x) === bank.sel; });
    if (!q) return '';
    return '<div class="bank-detail" data-bank-detail>' + katc(q) + '<h4>' + esc(q.title) + '</h4><p class="fine">' + esc(TOPICS[q.topic].title) + ' · ' + (q.kind === 'expr' ? 'Typed answer' : isObjective(q) ? 'Objective · A–D' : q.kind === 'explain' ? 'Subjective · written explanation' : 'Subjective · worked answer') + ' · ' + qValue(q) + ' mark' + (qValue(q) === 1 ? '' : 's') + '</p>' +
      '<p>' + esc(q.prompt) + '</p>' + formula(q) +
      (q.kind === 'mc' ? '<p><b>Correct choice:</b> ' + LETTERS[q.a] + ': ' + tex(q.choices[q.a] || '') + '</p>' : q.expected ? '<p><b>Answer the site checks:</b> ' + esc(q.expected) + '</p>' : '<p class="fine">No answer for the site to check, so you mark it in Marking.</p>') +
      '<details class="note"><summary>Worked solution</summary>' + q.solution.map(rich).join('<br>') + '</details>' +
      '<div class="row">' + (demo ? '<span class="tag">Demonstration question</span>' : '<button class="btn small" data-act="staff-edit" data-id="' + q.docId + '">Edit</button><button class="btn small quiet del" data-act="staff-delete" data-id="' + q.docId + '">Delete</button>') + '<button class="btn small quiet" data-act="bank-pick" data-key="' + esc(bankKey(q)) + '">Close</button></div></div>';
  }
  function drawAdminLists() {
    drawBankTabs();
    var list = view.querySelector('[data-question-list]');
    if (list) {
      var area = bank.tab, mine = sortedBank(staffData.questions.filter(function (q) { return q.area === area; }));
      var title = view.querySelector('[data-bank-title]');
      if (title) title.textContent = AREAS[area] + ' questions';
      var demo = !mine.length, shown = demo ? sortedBank(BUILT_IN[area] || []) : mine;
      list.innerHTML = (demo ? '<p class="bank-empty"><b>You haven’t added any ' + AREAS[area] + ' questions yet.</b> Students see the demonstration questions below. ' + (area === 'homework' ? 'Adding one replaces the demonstrations for its topic.' : 'Your first question replaces all of them.') + '</p>' : '') +
        blueprintHtml(area, shown, demo) + bankDetailHtml(shown, demo);
    }
    var videos = view.querySelector('[data-video-list]');
    if (videos) {
      /* Leaves the rows alone mid-upload or while someone is typing a link. */
      if (videos.querySelector('[data-busy]') || (document.activeElement && document.activeElement.dataset.videoInput)) return;
      videos.innerHTML = TOPIC_ORDER.map(function (id) {
        var v = staffData.videos[id];
        var status = v && v.assetId ? '✓ Video uploaded' + (v.name ? ': ' + esc(v.name) : '') : v && v.link ? '✓ Link added' : 'No video yet';
        return '<div class="video-row"><h3>' + esc(TOPICS[id].title) + '</h3><p class="fine">Presented by ' + esc(TOPICS[id].presenter) + '. ' + (STANDALONE && !v ? 'File name to upload: <b>' + VIDEO_FILES[id] + '</b>' : status) + '</p>' +
          '<div class="row">' + (STANDALONE ? '' : '<label class="btn small">Upload a video<input type="file" accept="video/*" data-video-file="' + id + '" hidden></label>') + (v ? '<button class="btn small quiet" data-act="staff-video-remove" data-id="' + id + '">Remove</button>' : '') + '</div>' +
          '<form class="link-form" data-form="video-link" data-topic="' + id + '"><label class="lbl" for="link-' + id + '">Or paste a video link</label><div class="row" style="margin-top:0"><input class="math-in link-input" id="link-' + id + '" data-video-input="1" type="url" placeholder="https://" value="' + esc(v && v.link) + '"><button class="btn small quiet" type="submit">Save link</button></div></form>' +
          '<p class="form-msg" data-msg data-video-msg="' + id + '" role="status"></p></div>';
      }).join('');
    }
  }
  var VIDEO_LIMIT = 20 * 1024 * 1024;
  async function uploadVideo(id, file) {
    var msg = view.querySelector('[data-video-msg="' + id + '"]');
    function say(text, bad) { if (msg) { msg.textContent = text; msg.classList.toggle('bad', !!bad); } }
    if (file.size > VIDEO_LIMIT) { say('That video is ' + (file.size / 1048576).toFixed(0) + ' MB, and the limit is 20 MB. Compress it, or upload it elsewhere and paste the link.', true); return; }
    var assets = await claude.use('assets');
    if (!assets) { say('Your account can’t upload files. Ask the project owner for Editor access.', true); return; }
    msg.dataset.busy = '1';
    say('Uploading… keep this page open.');
    try {
      var old = staffData.videos[id];
      var result = await assets.upload(file);
      await staff.db.doc('videos/' + id).set({ assetId: result.id, name: file.name.slice(0, 120), updatedAt: Date.now() });
      if (old && old.assetId) assets.delete(old.assetId).catch(function () { /* an unused old file does no harm */ });
      delete msg.dataset.busy;
      drawAdminLists();
      toast('Video uploaded for ' + TOPICS[id].title + '.');
    } catch (err) {
      delete msg.dataset.busy;
      say(err && err.code === 'too_large' ? 'That file is over the upload limit. Compress it, or paste a link.' : err && err.code === 'unsupported_type' ? 'That file type isn’t supported. Try an MP4.' : err && err.code === 'quota_exceeded' ? 'The site’s storage is full. Remove a video first.' : 'The upload didn’t finish. Check your connection and try again.', true);
    }
  }
  async function saveVideoLink(form) {
    var id = form.dataset.topic, link = form.querySelector('input').value.trim();
    var msg = view.querySelector('[data-video-msg="' + id + '"]');
    if (!/^https:\/\/\S+$/i.test(link)) { msg.textContent = 'Paste a full link starting with https://'; msg.classList.add('bad'); return; }
    var old = staffData.videos[id];
    await staff.db.doc('videos/' + id).set({ link: link, updatedAt: Date.now() });
    if (old && old.assetId) { var assets = await claude.use('assets'); if (assets) assets.delete(old.assetId).catch(function () { /* see uploadVideo */ }); }
    if (document.activeElement) document.activeElement.blur();
    drawAdminLists();
    toast('Link saved for ' + TOPICS[id].title + '.');
  }
  async function staffClick(d) {
    switch (d.act) {
      case 'staff-lock': setUnlocked(null); drawPasswordGate(); break;
      case 'staff-edit': {
        var q = staffData.questions.find(function (x) { return x.docId === d.id; });
        if (q) { if (bank.tab !== q.area) { bank.tab = q.area; drawBank(); } editingId = q.docId; openQuestionForm(q); }
        break;
      }
      case 'staff-cancel': closeQuestionForm(); break;
      case 'score-view': scoreView = d.view; drawResults(); break;
      case 'scores-csv': downloadScores(); break;
      case 'bank-add': editingId = null; openQuestionForm(null); break;
      case 'bank-tab': bank.tab = d.tab; bank.sel = ''; closeQuestionForm(); drawBank(); break;
      case 'bank-pick': {
        bank.sel = bank.sel === d.key ? '' : d.key;
        drawAdminLists();
        var det = view.querySelector('[data-bank-detail]');
        if (det) det.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'plan-step': {
        var box = view.querySelector('[data-plan="' + d.id + '"][data-strand="' + d.strand + '"][data-type="' + d.type + '"]');
        if (!box) break;
        box.value = Math.max(0, Math.min(20, (Number(box.value) || 0) + Number(d.step)));
        box.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'staff-delete': {
        var del = staffData.questions.find(function (x) { return x.docId === d.id; });
        if (del) dialog('Delete this question?', esc(del.title) + ' will disappear for students. This can’t be undone.', '<button class="btn quiet" data-act="close">Keep it</button><button class="btn" data-act="staff-delete-yes" data-id="' + d.id + '">Delete</button>');
        break;
      }
      case 'staff-delete-yes':
        closeModal();
        try { await staff.db.doc('questions/' + d.id).delete(); if (editingId === d.id) closeQuestionForm(); toast('Question deleted.'); } catch (e) { toast('That couldn’t be deleted. Try again.'); }
        break;
      case 'staff-board-remove':
        try { await staff.db.doc('board/' + d.id).delete(); } catch (e) { toast('That couldn’t be removed. Try again.'); }
        break;
      case 'staff-result-remove': {
        var rec = staffData.results.find(function (x) { return x.id === d.id; });
        if (rec) dialog('Remove this student’s scores?', esc(rec.data.name || 'This student') + ' will disappear from this table. If they do more work, they’ll reappear with their new scores.', '<button class="btn quiet" data-act="close">Keep them</button><button class="btn" data-act="staff-result-remove-yes" data-id="' + esc(d.id) + '">Remove</button>');
        break;
      }
      case 'staff-result-remove-yes':
        closeModal();
        try { await staff.db.doc('results/' + d.id).delete(); } catch (e) { toast('That couldn’t be removed. Try again.'); }
        break;
      case 'staff-video-remove': {
        var old = staffData.videos[d.id];
        try {
          await staff.db.doc('videos/' + d.id).delete();
          if (old && old.assetId) { var assets = await claude.use('assets'); if (assets) assets.delete(old.assetId).catch(function () { /* see uploadVideo */ }); }
        } catch (e) { toast('That couldn’t be removed. Try again.'); }
        break;
      }
    }
  }

  /* ---------- Router ---------- */
  var routeToken = 0;
  function parts() { return location.hash.replace(/^#/, '').split('-'); }
  function route() {
    routeToken += 1;
    stopTicker();
    closeModal();
    hideIntro();
    clearCook();
    document.documentElement.classList.remove('focusing');
    var p = parts(), page = p[0] || 'home';
    if (page === 'view' || page === 'question') return;
    if (page !== 'practice') lastPage = location.hash || '#home';
    renderPage();
    window.scrollTo(0, 0);
  }
  function renderPage() {
    var p = parts(), page = p[0] || 'home', id = p[1];
    var navKey = page === 'mistakes' ? 'dashboard' : page === 'practice' ? 'homework' : page === 'formulas' ? 'lessons' : page === 'results' ? (state.history[Number(id)] && isQuiz(state.history[Number(id)].key) ? 'quizzes' : 'tests') : page;
    renderNav(navKey);
    if (page === 'home') pageHome();
    else if (page === 'lessons') { if (id) pageLesson(id); else pageLessonList(); }
    else if (page === 'homework') pageHomework(id);
    else if (page === 'quizzes' || page === 'tests') { if (id) pageAssessment(id); else pagePicker(page); }
    else if (page === 'results') { pageResults(id); addScoreNote(); }
    else if (page === 'dashboard') pageProgress();
    else if (page === 'mistakes') pageMistakes();
    else if (page === 'formulas') pageFormulas();
    else if (page === 'practice') pagePractice(id);
    else if (page === 'staff') pageStaff();
    else if (page === 'admin') pageAdmin();
    else location.hash = '#home';
  }
  var lastPage = '';
  window.addEventListener('hashchange', route);

  /* ---------- Typing and uploads ---------- */
  var sideTimer = null;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.explore !== undefined) { updateExplorer(); return; }
    if (el.id === 'q-tex') { var pv = document.getElementById('q-tex-preview'); if (pv) pv.innerHTML = el.value.trim() ? tex(el.value, true) : ''; return; }
    if (!el.dataset.field) return;
    answerFor(el.dataset.scope)[el.dataset.field] = el.value;
    save();
    /* Waits for a pause in typing, so typing itself stays instant. */
    clearTimeout(sideTimer);
    sideTimer = setTimeout(function () {
      if (el.dataset.scope.charAt(0) === 'h') drawChecks();
      else if (state.live[el.dataset.scope.split(':')[1]]) drawFocusNav(el.dataset.scope.split(':')[1]);
    }, 250);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.videoFile && el.files[0]) uploadVideo(el.dataset.videoFile, el.files[0]);
    if (el.id === 'q-kind' || el.id === 'q-area') syncQuestionForm();
  });

  /* ---------- Clicks ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var d = el.dataset;
    switch (d.act) {
      case 'mark-open': marking.open = marking.open === d.id ? '' : d.id; drawMarking(); break;
      case 'mark-show': marking.show = d.show; marking.open = ''; drawMarking(); break;
      case 'teacher-mark': setTeacherMark(d.sid, d.key, d.v); break;
      case 'plan-clear': savePlan(d.id, null); break;
      case 'pad-tool': case 'pad-undo': case 'pad-clear': case 'pad-more': padAct(d.act, d.scope, d.tool); break;
      case 'symbol': {
        var input = el.closest('section').querySelector('[data-field="answer"]');
        if (!input) break;
        var start = input.selectionStart === null ? input.value.length : input.selectionStart;
        input.value = input.value.slice(0, start) + d.insert + input.value.slice(input.selectionEnd === null ? start : input.selectionEnd);
        input.focus();
        var caret = start + d.insert.length - (d.insert === '()' ? 1 : 0);
        input.setSelectionRange(caret, caret);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
      case 'pick': {
        answerFor(d.scope).pick = Number(d.pick);
        save();
        if (d.scope.charAt(0) === 'a') {
          var aid = d.scope.split(':')[1];
          drawQuestion(aid); drawFocusNav(aid);
          var picked = view.querySelector('[data-act="pick"][data-pick="' + d.pick + '"]');
          if (picked) picked.focus();
        }
        break;
      }
      case 'hw': selectHomework(d.id, true); break;
      case 'hw-go': selectHomework(homeworkFor(hw.topic)[Number(d.to)].id, true); break;
      case 'hw-hint': hw.hints += 1; drawHomeworkPanel(); break;
      case 'hw-solution': hw.solution = !hw.solution; drawHomeworkPanel(); break;
      case 'hw-check': {
        var q = COURSE.homework.find(function (x) { return x.id === hw.id; });
        var typed = (state.homework[hw.id] || {}).answer || '';
        var same = typed.trim() ? sameExpression(typed, q.expected) : null;
        if (same === true) { sizzle(); if (award('homework', 'w:hw:' + hw.id)) pointsToast('homework'); }
        hw.result = !typed.trim() ? ['', 'Type an answer first.'] :
          same === null ? ['', 'This answer couldn’t be read. Use a form like 3x^2 + 2x, or compare your work with the worked solution.'] :
          same ? ['ok', '✓ That matches the answer.'] : ['no', 'Not quite yet. Try a hint, then check again.'];
        drawChecks(); drawHomeworkPanel();
        break;
      }
      case 'hw-reset':
        dialog('Reset homework?', 'This clears your saved homework answers on this device.', '<button class="btn quiet" data-act="close">Keep working</button><button class="btn" data-act="hw-reset-yes">Reset attempt</button>');
        break;
      case 'hw-reset-yes': state.homework = {}; state.hwResetAt = Date.now(); save(); route(); break;
      case 'close': closeModal(); break;
      case 'go': {
        state.live[d.id].current = Number(d.to);
        save();
        drawQuestion(d.id); drawFocusNav(d.id);
        var box = view.querySelector('[data-question]');
        if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: 'start' });
        box.querySelector('.q-title').focus({ preventScroll: true });
        break;
      }
      case 'submit': confirmSubmit(d.id); break;
      case 'final': finishAssessment(d.id); break;
      case 'reset-attempt': delete state.live[d.id]; save(); route(); break;
      case 'reset':
        dialog('Start over?', 'This clears your scores, homework answers and drawings on this device.', '<button class="btn quiet" data-act="close">Cancel</button><button class="btn" data-act="reset-yes">Start over</button>');
        break;
      case 'reset-yes': { var keep = state.profile, keepSound = state.sound, keepBoard = state.board, keepPts = state.pts, keepUsed = state.used; state = freshState(); if (keepPts) state.pts = keepPts; if (keepUsed) state.used = keepUsed; state.resetAt = Date.now(); state.sound = keepSound; if (keep) state.profile = keep; if (keepBoard) state.board = keepBoard; save(); route(); break; }
      case 'sound': state.sound = !state.sound; persist(); drawSoundButton(); if (state.sound) sizzle(true); break;
      case 'formulas':
        modal.hidden = false;
        modal.innerHTML = '<div class="dialog wide" role="dialog" aria-modal="true" aria-label="Formula sheet"><h2>Formula sheet</h2>' + formulasHtml() + '<div class="row"><button class="btn" data-act="close">Close</button></div></div>';
        modal.querySelector('[data-act="close"]').focus();
        break;
      case 'retry-check': {
        var rq = retryQuestion(d), rin = view.querySelector('[data-retry="' + d.key + '"]');
        if (rq && rin) { var rtyped = rin.value.trim(); retryResult(d, rtyped ? sameExpression(rtyped, rq.expected) : false); }
        break;
      }
      case 'retry-pick': { var mq = retryQuestion(d); if (mq) retryResult(d, Number(d.pick) === mq.a); break; }
      case 'practice-check': {
        var ptyped = view.querySelector('#practice-in').value.trim();
        if (!ptyped) { practice.msg = 'Type an answer first.'; practice.bad = true; drawPractice(); break; }
        var pres = sameExpression(ptyped, practice.q.expected);
        practice.typed = ptyped;
        if (pres === true) { if (!practice.done) { award('practice'); pointsToast('practice'); } practice.right++; practice.done = true; practice.msg = 'Correct. Nicely done.'; practice.bad = false; sizzle(); }
        else { practice.msg = pres === null ? 'That answer can’t be read. Try a form like 3x^2 + cos(x).' : 'Not yet. Try again, or use the hint.'; practice.bad = true; }
        drawPractice();
        if (!practice.done) { var pin = view.querySelector('#practice-in'); pin.value = ptyped; pin.focus(); }
        break;
      }
      case 'practice-exit': {
        var got = practice ? practice.right : 0;
        practice = null;
        location.hash = lastPage && !/^#(practice|quizzes-|tests-)/.test(lastPage) ? lastPage : '#homework';
        if (got) setTimeout(function () { toast('Nice cooking. You got ' + got + ' right this round.'); }, 60);
        break;
      }
      case 'practice-new': practice = { topic: practice.topic, right: practice.right, q: MAKERS[practice.topic]() }; drawPractice(); view.querySelector('#practice-in').focus(); break;
      case 'practice-hint': { var ph = view.querySelector('#practice-in').value; practice.showHint = true; drawPractice(); if (!practice.done) view.querySelector('#practice-in').value = ph; break; }
      case 'practice-solution': { var ps = view.querySelector('#practice-in').value; practice.showSolution = true; drawPractice(); if (!practice.done) view.querySelector('#practice-in').value = ps; break; }
      case 'board-leave': leaveBoard(); break;
      case 'board-tab': board.tab = d.tab; view.querySelectorAll('[data-act="board-tab"]').forEach(function (b) { b.setAttribute('aria-selected', b === el); }); drawBoard(); break;
      case 'name-edit': editingName = true; route(); { var nameBox = document.getElementById('st-name'); if (nameBox) nameBox.focus(); } break;
      default: staffClick(d, el);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.hidden && intro.id && !intro.busy) { location.hash = '#' + kindOf(intro.id); return; }
    if (e.key !== 'Escape' || modal.hidden) return;
    var closer = modal.querySelector('[data-act="close"]');
    if (closer) closer.click();
  });

  /* The living kitchen. assets/kitchen-scene.svg is the still room; everything here moves on top of it.
     All positions are fixed scene units (1600 x 900), so it looks the same on every visit. */
  function buildKitchen() {
    var holder = document.querySelector('.backdrop');
    if (!holder) return;
    var INK = '#2a1207';
    function at(x, y, w, h, extra) {
      var o = { left: x, top: y, width: w, height: h };
      var style = Object.keys(o).map(function (k) { return k + ':calc(var(--u) * ' + o[k] + ')'; }).join(';');
      Object.keys(extra || {}).forEach(function (k) { style += ';--' + k + ':' + extra[k]; });
      return 'style="' + style + '"';
    }
    function piece(cls, x, y, w, h, extra, inner) { return '<i class="moves ' + cls + '" ' + at(x, y, w, h, extra) + '>' + (inner || '') + '</i>'; }
    function tongue(cls, seed) { return '<b class="moves tongue ' + cls + '" style="--t:' + (.62 + (seed * 37 % 50) / 100) + 's;--d:' + (-(seed * 53 % 90) / 100) + 's"></b>'; }
    /* One flame: base centre x, base y, width, height. */
    function flame(x, y, w, h, seed, cls) {
      var inner = tongue('outer', seed) + tongue('mid', seed + 3) + (w > 18 ? tongue('core', seed + 5) : '');
      return '<i class="fire ' + (cls || '') + '" ' + at(x - w / 2, y - h, w, h) + '>' + inner + '</i>';
    }

    var html = '<img src="assets/kitchen-scene.svg" alt="" width="1600" height="900" decoding="async">';

    /* Firelight on the wall, then the oven fire itself. */
    html += piece('glow', 544, 196, 640, 640, { t: '2.3s', d: '0s' });
    html += piece('glow', 744, 440, 240, 240, { t: '1.3s', d: '-.5s' });
    [[864, 616, 104, 150, 1], [824, 618, 66, 104, 2], [904, 618, 70, 112, 4], [846, 620, 50, 76, 6], [884, 620, 46, 70, 7]].forEach(function (f) {
      html += flame(f[0], f[1], f[2], f[3], f[4]);
    });
    [[0, 830, 590, 15, 0], [1, 860, 585, 11, -3], [2, 892, 590, 13, -6], [3, 846, 590, 18, -8], [4, 878, 585, 12, -1.5], [5, 905, 590, 16, -10]].forEach(function (e) {
      html += piece('ember', e[1], e[2], 5 + e[0] % 3, 5 + e[0] % 3, { t: e[3] + 's', d: e[4] + 's', x: (e[0] % 2 ? 46 : -38), r: 500 + e[0] * 34 });
    });

    /* Burners. Flames sit behind the pans and lick up around them. */
    [[130, 'far'], [310, 'far'], [1320, 'far'], [1480, 'far']].forEach(function (b, i) {
      html += piece('glow ' + b[1], b[0] - 110, 586, 220, 220, { t: (1.4 + i * .3) + 's', d: -i * .4 + 's' });
      [-36, -18, 0, 18, 36].forEach(function (dx, j) {
        html += flame(b[0] + dx, 700, 22, 40 - Math.abs(dx) * .3, i * 5 + j + 1, b[1]);
      });
    });

    /* Skillet: the steak gets flipped, and the fat flares up when it lands. */
    html += '<i class="moves flare far" ' + at(80, 550, 100, 120, { d: '0s' }) + '>' + tongue('outer', 8) + tongue('mid', 9) + tongue('core', 10) + '</i>';
    html += '<i class="moves flip far" ' + at(92, 622, 76, 56, { d: '0s' }) + '><img src="' + SPRITES + 'steak.webp" alt="" width="76" height="56" style="width:100%;height:100%"></i>';
    html += '<i class="far" ' + at(36, 654, 310, 50) + '><svg viewBox="0 0 310 50" aria-hidden="true"><path d="M8 6H180L168 38Q165 44 156 44H32Q23 44 20 38Z" fill="#2c2420" stroke="' + INK + '" stroke-width="5"/><path d="M178 12L300 4Q308 4 307 12Q306 18 298 18L176 24Z" fill="#3a2a20" stroke="' + INK + '" stroke-width="5"/></svg></i>';
    html += piece('steam far', 90, 520, 90, 140, { t: '6s', d: '-1s', x: 30 });

    /* Saucepan with a rattling lid. */
    html += piece('lid far', 252, 582, 116, 34, { d: '-1s' }, '<svg viewBox="0 0 116 34" aria-hidden="true"><path d="M6 32Q58 2 110 32Z" fill="#c9672d" stroke="' + INK + '" stroke-width="5"/><circle cx="58" cy="11" r="7" fill="#3d2110" stroke="' + INK + '" stroke-width="3"/></svg>');
    html += piece('steam far', 268, 450, 90, 150, { t: '5s', d: '-3s', x: -26 });

    /* Stock pot: steam and a little calculus. */
    [[1262, 7, 0, 30], [1316, 8.5, -3, -34], [1360, 7.5, -5.5, 24]].forEach(function (s) {
      html += piece('steam far', s[0] - 40, 450, 110, 150, { t: s[1] + 's', d: s[2] + 's', x: s[3] });
    });
    [['dy/dx', 1270, 12, 0, -30], ['x²', 1330, 13, -4, 26], ['f′(x)', 1296, 14, -8, 40], ['sin x', 1350, 12, -10.5, -20]].forEach(function (m) {
      html += '<span class="moves rise far" ' + at(m[1], 560, 90, 40, { t: m[2] + 's', d: m[3] + 's', x: m[4] }) + '>' + m[0] + '</span>';
    });

    /* Fryer: a batch of fries bobbing in the oil. */
    html += '<i class="moves bob far" ' + at(1438, 556, 84, 84, { d: '0s' }) + '><img src="' + SPRITES + 'fries.webp" alt="" width="84" height="84" style="width:100%;height:100%"></i>';
    html += '<i class="far" ' + at(1414, 618, 132, 74) + '><svg viewBox="0 0 132 74" aria-hidden="true"><path d="M8 3H124L116 62Q114 70 106 70H26Q18 70 16 62Z" fill="#6e645a" stroke="' + INK + '" stroke-width="5"/><rect x="22" y="12" width="9" height="46" rx="4" fill="#cfc5b7" opacity=".5"/></svg></i>';

    /* Pans on the rail, swaying. */
    function hangingPan(r, c) { return '<svg viewBox="0 0 80 150" aria-hidden="true"><rect x="36" y="0" width="8" height="80" rx="3" fill="#3a2414" stroke="' + INK + '" stroke-width="3"/><circle cx="40" cy="' + (80 + r - 6) + '" r="' + r + '" fill="' + c + '" stroke="' + INK + '" stroke-width="5"/><circle cx="40" cy="' + (80 + r - 6) + '" r="' + (r * .68) + '" fill="#000" opacity=".2"/></svg>'; }
    html += piece('pan far', 1016, 128, 72, 135, { t: '3.4s', d: '0s' }, hangingPan(34, '#4a3a30'));
    html += piece('pan far', 1082, 128, 62, 116, { t: '2.8s', d: '-1s' }, hangingPan(28, '#b5541f'));
    html += piece('pan far', 1138, 128, 34, 120, { t: '3s', d: '-2s' }, '<svg viewBox="0 0 34 120" aria-hidden="true"><rect x="13" y="0" width="8" height="84" rx="3" fill="#b9ac9c" stroke="' + INK + '" stroke-width="3"/><path d="M3 84H31V96Q31 116 17 116Q3 116 3 96Z" fill="#b9ac9c" stroke="' + INK + '" stroke-width="4"/></svg>');
    html += piece('pan far', 1180, 128, 44, 122, { t: '3.7s', d: '-.6s' }, hangingPan(17, '#6a5a4c'));

    /* Pendant lamps. */
    [[640, 6.2, 0, 'far no-tablet'], [1120, 7.4, -3, 'far'], [1480, 5.6, -5, 'far'], [170, 6.8, -2, 'wide-only far']].forEach(function (l) {
      html += piece('glow ' + l[3], l[0] - 190, 34, 380, 380, { t: '3.1s', d: l[2] + 's' });
      html += piece('lamp ' + l[3], l[0] - 42, 66, 84, 116, { t: l[1] + 's', d: l[2] + 's' }, '<svg viewBox="0 0 84 116" aria-hidden="true"><rect x="40" y="0" width="4" height="66" fill="#1c0d05"/><path d="M26 66H58L78 104H6Z" fill="#6d1320" stroke="' + INK + '" stroke-width="4"/><ellipse cx="42" cy="106" rx="15" ry="9" fill="#ffe9a8" stroke="' + INK + '" stroke-width="3"/></svg>');
    });

    holder.innerHTML = '<div class="scene">' + html + '</div>';
  }
  /* Fire sweep on the main tabs: flames rise, the page changes while the screen is fully covered, and the fire burns out. */
  var BURN_RISE = 300, BURN_CLEAR = 560;
  var burn = { el: null, stage: 0, target: '' };
  function buildBurn() {
    var el = document.createElement('div');
    el.id = 'burn';
    el.setAttribute('aria-hidden', 'true');
    el.hidden = true;
    function tongue(cls, seed) { return '<b class="tongue ' + cls + '" style="--t:' + (.28 + (seed * 37 % 22) / 100) + 's;--d:' + (-(seed * 53 % 40) / 100) + 's"></b>'; }
    /* Fixed spread of flames, tall and short, overlapping so there are no gaps along the edge. */
    function row(cls, sizes) {
      return sizes.map(function (h, i) {
        return '<i class="burn-flame ' + cls + '" style="left:' + (i * 100 / sizes.length - 5) + '%;width:' + (100 / sizes.length + 10) + '%;height:' + h + 'vmin">' + tongue('outer', i + 1) + tongue('mid', i + 4) + tongue('core', i + 7) + '</i>';
      }).join('');
    }
    /* Flames inside the wall, so the covered moment is still a fire and not a flat colour. */
    function inner(top, sizes) {
      return sizes.map(function (h, i) {
        return '<i class="burn-flame inner" style="top:' + top + 'vh;left:' + (i * 100 / sizes.length - 4) + '%;width:' + (100 / sizes.length + 8) + '%;height:' + h + 'vmin">' + tongue('mid', i + 2) + tongue('core', i + 6) + '</i>';
      }).join('');
    }
    var sparks = '';
    for (var i = 0; i < 16; i++) {
      sparks += '<i class="burn-spark" style="left:' + ((i * 37 + 6) % 100) + '%;--x:' + ((i % 2 ? 1 : -1) * (12 + i * 5)) + 'px;--d:' + (i * 19 % 180) + 'ms;--r:' + (70 + i * 7 % 50) + 'vh"></i>';
    }
    el.innerHTML = '<div class="burn-floor">' + row('', [26, 38, 24, 42, 30, 36, 22, 40, 28]) + '</div>' +
      '<div class="burn-wall">' + row('lead', [40, 58, 36, 66, 46, 60, 34, 54, 44]) + inner(28, [52, 36, 64, 42, 56, 34, 60]) + inner(78, [38, 62, 44, 58, 36, 66, 48]) + inner(128, [50, 34, 58, 40, 62, 36, 46]) + '</div>' + sparks;
    document.body.appendChild(el);
    burn.el = el;
  }
  function burnSwap() {
    if (location.hash === burn.target) { route(); }
    else { location.hash = burn.target; }
  }
  function playBurn(target) {
    if (burn.stage === 1) { burn.target = target; return; }
    if (burn.stage === 2) { location.hash = target; return; }
    if (!burn.el) buildBurn();
    burn.stage = 1;
    burn.target = target;
    var el = burn.el;
    el.className = '';
    el.hidden = false;
    void el.offsetWidth; /* Starts the flames from below the screen. */
    el.className = 'rise';
    setTimeout(function () {
      burnSwap();
      burn.stage = 2;
      /* Two frames, so the new page is painted before any of it shows. */
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        el.className = 'clear';
        setTimeout(function () { el.hidden = true; el.className = ''; burn.stage = 0; }, BURN_CLEAR);
      }); });
    }, BURN_RISE);
  }
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('#nav .nav-item');
    if (!link || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var target = link.getAttribute('href');
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    playBurn(target);
  });

  buildKitchen();
  drawSoundButton();
  startStaffData();
  loadCloud();
  route();

  /* Exposed so the answer checker can be tested. */
  window.__checkAnswer = sameExpression;
})();
