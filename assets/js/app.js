(function () {
  'use strict';

  /* =========================================================
     HELPERS
     ========================================================= */
  var $ = function (sel) { return document.querySelector(sel); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOTAL_STEPS = 7;

  /* =========================================================
     STATE – every choice lives here
     ========================================================= */
  var state = {
    step: 1, date: null, time: null, food: null, activity: null,
    message: '',                    // optional personal note
    saved: false,                   // true only after the server confirms the save
    submissionId: newToken()        // lets the server ignore accidental duplicate sends
  };

  /* random id for one "plan" – makes retries and double clicks safe */
  function newToken() {
    var a = new Uint8Array(16), out = '', i;
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    for (i = 0; i < 16; i++) out += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return out;
  }

  var FOODS = [
    { id: 'pizza',     label: 'Pizza',          tag: '🍕', art: '🍕', a: '#fff1d6', b: '#ffd9a0' },
    { id: 'burger',    label: 'Burger',         tag: '🍔', art: '🍔', a: '#ffe8d2', b: '#ffc79a' },
    { id: 'pasta',     label: 'Pasta',          tag: '🍝', art: '🍝', a: '#fff4d1', b: '#ffe08f' },
    { id: 'sushi',     label: 'Sushi',          tag: '🍣', art: '🍣', a: '#ffe3e6', b: '#ffb3bd' },
    { id: 'icecream',  label: 'Ice cream',      tag: '🍦', art: '🍦', a: '#fff0f7', b: '#ffc4de' },
    { id: 'chicken',   label: 'Chicken',        tag: '🍗', art: '🍗', a: '#ffeed8', b: '#ffcb94' },
    { id: 'ethiopian', label: 'Ethiopian food', tag: '🇪🇹', art: '🍲', a: '#f1f7d9', b: '#f6d98a' },
    { id: 'surprise',  label: 'Surprise me',    tag: '🎁', art: '🎁', a: '#ffe3ee', b: '#ffb0cf' }
  ];
  var ACTIVITIES = [
    { id: 'cinema',   label: 'Cinema',         tag: '🎬', art: '🎬', a: '#ece4ff', b: '#cbb8ff' },
    { id: 'park',     label: 'Park',           tag: '🌳', art: '🌳', a: '#e3f7e0', b: '#b5e5ac' },
    { id: 'walk',     label: 'Romantic walk',  tag: '🌅', art: '🌅', a: '#fff0d9', b: '#ffbfa0' },
    { id: 'cafe',     label: 'Cute café',      tag: '☕', art: '☕', a: '#f6e9df', b: '#e1bfa3' },
    { id: 'shopping', label: 'Shopping',       tag: '🛍️', art: '🛍️', a: '#ffe3f1', b: '#ffb0d6' },
    { id: 'dinner',   label: 'Dinner date',    tag: '🕯️', art: '🕯️', a: '#fff3d6', b: '#ffd88a' },
    { id: 'surprise', label: 'Surprise me',    tag: '🎁', art: '🎁', a: '#ffe3ee', b: '#ffb0cf' }
  ];

  /* =========================================================
     BACKGROUND – floating hearts, petals & flowers
     ========================================================= */
  (function buildBackground() {
    var layer = $('#bgLayer');
    var icons = ['💗', '💕', '🌸', '🌷', '💖', '🌺', '🤍', '🌹', '💞'];
    var count = window.innerWidth < 600 ? 14 : 24;
    for (var i = 0; i < count; i++) {
      var el = document.createElement('span');
      el.className = 'floaty';
      el.textContent = icons[i % icons.length];
      el.style.left = rand(0, 100) + '%';
      el.style.fontSize = rand(14, 34) + 'px';
      el.style.animationDuration = rand(12, 26) + 's';
      el.style.animationDelay = (-rand(0, 26)) + 's';
      el.style.setProperty('--drift', rand(-60, 60) + 'px');
      el.style.setProperty('--spin', rand(-50, 50) + 'deg');
      layer.appendChild(el);
    }
  })();

  /* Burst of rising emoji during celebrations */
  var riserTimer = null;
  function startRisers(icons, every) {
    stopRisers();
    if (reduced) return;
    var layer = $('#riserLayer');
    function spawn() {
      var el = document.createElement('span');
      el.className = 'riser';
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      el.style.left = rand(2, 96) + '%';
      el.style.fontSize = rand(22, 50) + 'px';
      var dur = rand(4, 7);
      el.style.animationDuration = dur + 's';
      el.style.setProperty('--drift', rand(-80, 80) + 'px');
      el.style.setProperty('--spin', rand(-40, 40) + 'deg');
      layer.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, dur * 1000 + 100);
    }
    for (var i = 0; i < 10; i++) setTimeout(spawn, i * 90);
    riserTimer = setInterval(spawn, every);
  }
  function stopRisers() {
    clearInterval(riserTimer); riserTimer = null;
    $('#riserLayer').textContent = '';
  }

  /* =========================================================
     CONFETTI ENGINE (canvas)
     ========================================================= */
  var cv = $('#confetti');
  var ctx = cv.getContext('2d');
  var parts = [];
  var raf = null;
  var streaming = false;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var COLORS = ['#ff7eb3', '#ff5c9d', '#ffc2d9', '#ffffff', '#f6c453', '#e4457d', '#ffd6e6', '#ffa3c4'];

  function sizeCanvas() {
    cv.width = Math.floor(window.innerWidth * dpr);
    cv.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function addParticle(x, y, burst) {
    parts.push({
      x: x, y: y,
      vx: burst ? rand(-7, 7) : rand(-1.2, 1.2),
      vy: burst ? rand(-13, -3) : rand(1.5, 3.5),
      g: burst ? .28 : .05,
      size: rand(6, 13),
      rot: rand(0, Math.PI * 2), vr: rand(-.2, .2),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: ['rect', 'circle', 'heart'][Math.floor(Math.random() * 3)],
      life: 0, max: rand(150, 260)
    });
  }

  function drawHeart(s) {
    ctx.beginPath();
    ctx.moveTo(0, s * .3);
    ctx.bezierCurveTo(-s * .9, -s * .3, -s * .5, -s * .9, 0, -s * .35);
    ctx.bezierCurveTo(s * .5, -s * .9, s * .9, -s * .3, 0, s * .3 + s * .35);
    ctx.closePath();
    ctx.fill();
  }

  function loop() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (streaming && Math.random() < .55) addParticle(rand(0, window.innerWidth), -12, false);

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life++;
      p.vy += p.g; p.vx *= .992;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      var alpha = p.life > p.max - 40 ? Math.max(0, (p.max - p.life) / 40) : 1;
      if (p.life > p.max || p.y > window.innerHeight + 30) { parts.splice(i, 1); continue; }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2); ctx.fill(); }
      else drawHeart(p.size / 1.6);
      ctx.restore();
    }
    if (parts.length || streaming) raf = requestAnimationFrame(loop);
    else { raf = null; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  function confettiBurst(n, x, y) {
    var count = reduced ? Math.floor(n / 4) : n;
    for (var i = 0; i < count; i++) addParticle(x, y, true);
    kick();
  }
  function confettiShow() {
    var w = window.innerWidth, h = window.innerHeight;
    confettiBurst(110, w * .5, h * .45);
    setTimeout(function () { confettiBurst(70, w * .2, h * .6); }, 250);
    setTimeout(function () { confettiBurst(70, w * .8, h * .6); }, 450);
  }
  function confettiStream(on) {
    streaming = on && !reduced;
    if (streaming) kick();
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var busy = false;

  // progress dots
  var dotsEl = $('#dots');
  for (var d = 0; d < TOTAL_STEPS; d++) dotsEl.appendChild(document.createElement('span'));
  function updateDots(n) {
    dotsEl.setAttribute('aria-label', 'Step ' + n + ' of ' + TOTAL_STEPS);
    Array.prototype.forEach.call(dotsEl.children, function (dot, i) {
      dot.className = i + 1 < n ? 'done' : (i + 1 === n ? 'now' : '');
    });
  }

  function go(n) {
    if (busy) return;
    var current = document.querySelector('.step.active');
    var target = $('#step' + n);
    if (!target) return;
    busy = true;

    function show() {
      steps.forEach(function (s) { s.classList.remove('active', 'leaving'); s.hidden = true; });
      target.hidden = false;
      target.classList.add('active');
      state.step = n;
      updateDots(n);
      window.scrollTo(0, 0);
      onEnter(n);
      var h = target.querySelector('h1, h2');
      if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      busy = false;
    }

    if (current && !reduced) {
      current.classList.add('leaving');
      setTimeout(show, 220);
    } else show();
  }

  function onEnter(n) {
    // stop any ongoing celebrations first
    stopRisers();
    confettiStream(false);

    if (n === 1) requestAnimationFrame(placeNoAtSlot);
    if (n === 2) { confettiShow(); startRisers(['💗', '💕', '❤️', '💖', '🥰'], 380); }
    if (n === 3) { renderCalendar(); renderTimes(); updateNext3(); }
    if (n === 4) { renderOptions('foodGrid', FOODS, 'food'); updateNext('next4', 'hint4', state.food, 'Pick a dish to continue 🍽️'); }
    if (n === 5) { renderOptions('activityGrid', ACTIVITIES, 'activity'); updateNext('next5', 'hint5', state.activity, 'Pick an adventure to continue 🌿'); }
    if (n === 6) {
      renderSummary('summary6');
      msgBox.value = state.message;
      updateCount();
      hideSaveError();
    }
    if (n === 7) {
      renderSummary('summary7');
      savedBadge.hidden = !state.saved;
      confettiShow();
      setTimeout(function () { if (state.step === 7) confettiStream(true); }, 900);
      startRisers(['💗', '🌸', '🌷', '💋', '🌹', '💕', '🌺', '✨'], 320);
    }
  }

  /* =========================================================
     STEP 1 – THE EVASIVE "NO" BUTTON
     ========================================================= */
  var arena = $('#arena'), yesBtn = $('#yesBtn'), noBtn = $('#noBtn'), noSlot = $('#noSlot'), noMsg = $('#noMsg');
  var NO_MESSAGES = [
    'Too slow! 😂', 'Nope, try again!', 'You know you want to say YES!', 'Nice try 😏',
    'Whoops, it ran away! 🏃‍♀️', 'The NO button is shy 🙈', 'Just press YES already! 💕', 'Not today, cutie 😘'
  ];
  var escapes = 0;

  /* Put NO back in its natural spot (next to YES) */
  function placeNoAtSlot() {
    var a = arena.getBoundingClientRect();
    var s = noSlot.getBoundingClientRect();
    if (!a.width) return;
    noBtn.style.transition = 'none';
    noBtn.style.left = (s.left - a.left) + 'px';
    noBtn.style.top = (s.top - a.top) + 'px';
    void noBtn.offsetWidth;       // flush so the reset is instant
    noBtn.style.transition = '';
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /* Jump to the spot inside the arena that is farthest from the pointer,
     never overlapping the YES button and never leaving the card. */
  function moveNo(px, py) {
    var a = arena.getBoundingClientRect();
    var y = yesBtn.getBoundingClientRect();
    var w = noBtn.offsetWidth, h = noBtn.offsetHeight, pad = 8;
    var maxX = a.width - w - pad, maxY = a.height - h - pad;
    if (maxX < pad || maxY < pad) return;
    var gap = 16;

    function ok(x, yy) {
      return !overlap(a.left + x, a.top + yy, w, h, y.left - gap, y.top - gap, y.width + gap * 2, y.height + gap * 2);
    }
    function dist(x, yy) { return Math.hypot(a.left + x + w / 2 - px, a.top + yy + h / 2 - py); }

    var best = null, bestD = -1, i, x, yy, dd;
    for (i = 0; i < 80; i++) {
      x = rand(pad, maxX); yy = rand(pad, maxY);
      if (!ok(x, yy)) continue;
      dd = dist(x, yy);
      if (dd > bestD) { bestD = dd; best = [x, yy]; }
    }
    // always also consider the four corners (they are usually the farthest)
    [[pad, pad], [maxX, pad], [pad, maxY], [maxX, maxY]].forEach(function (c) {
      if (!ok(c[0], c[1])) return;
      dd = dist(c[0], c[1]);
      if (dd > bestD) { bestD = dd; best = c; }
    });
    if (!best) return;

    noBtn.style.left = best[0] + 'px';
    noBtn.style.top = best[1] + 'px';
    escaped();
  }

  function escaped() {
    escapes++;
    noMsg.textContent = NO_MESSAGES[(escapes - 1) % NO_MESSAGES.length];
    noMsg.classList.remove('pop'); void noMsg.offsetWidth; noMsg.classList.add('pop');
    // YES slowly grows (capped) – a gentle hint about the right answer
    yesBtn.style.transform = 'scale(' + Math.min(1 + escapes * 0.03, 1.22) + ')';
  }

  /* Is the pointer within `radius` px of the NO button? */
  function near(px, py, radius) {
    var r = noBtn.getBoundingClientRect();
    var dx = Math.max(r.left - px, 0, px - r.right);
    var dy = Math.max(r.top - py, 0, py - r.bottom);
    return Math.hypot(dx, dy) <= radius;
  }

  window.addEventListener('pointermove', function (e) {
    if (state.step !== 1) return;
    if (near(e.clientX, e.clientY, e.pointerType === 'mouse' ? 95 : 120)) moveNo(e.clientX, e.clientY);
  }, { passive: true });

  // Touch / pen: react the instant a finger lands near the button – before a tap can complete
  window.addEventListener('pointerdown', function (e) {
    if (state.step !== 1) return;
    if (near(e.clientX, e.clientY, 120)) moveNo(e.clientX, e.clientY);
  }, { passive: true });

  noBtn.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    e.preventDefault();                       // stops the emulated click entirely
    moveNo(t.clientX, t.clientY);
  }, { passive: false });

  // Keyboard users: focusing or "pressing" NO also makes it run away
  noBtn.addEventListener('focus', function () {
    var r = noBtn.getBoundingClientRect();
    moveNo(r.left + r.width / 2, r.top + r.height / 2);
  });
  noBtn.addEventListener('click', function (e) {
    e.preventDefault();
    var r = noBtn.getBoundingClientRect();
    moveNo(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
  });

  window.addEventListener('resize', function () {
    sizeCanvas();
    if (state.step === 1) placeNoAtSlot();
  });

  yesBtn.addEventListener('click', function () { go(2); });

  /* =========================================================
     STEP 2
     ========================================================= */
  $('#next2').addEventListener('click', function () { go(3); });

  /* =========================================================
     STEP 3 – CALENDAR & TIME
     ========================================================= */
  var today0 = new Date(); today0.setHours(0, 0, 0, 0);
  var view = { y: today0.getFullYear(), m: today0.getMonth() };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isToday(k) { var t = new Date(); return k === keyOf(t.getFullYear(), t.getMonth(), t.getDate()); }

  function renderCalendar() {
    // refresh "today" in case the page has been open past midnight
    today0 = new Date(); today0.setHours(0, 0, 0, 0);
    if (state.date && !view.shown) { var sd = parseKey(state.date); view.y = sd.getFullYear(); view.m = sd.getMonth(); }
    view.shown = true;

    var grid = $('#calGrid');
    grid.textContent = '';
    $('#calTitle').textContent = new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    $('#calPrev').disabled = (view.y === today0.getFullYear() && view.m === today0.getMonth()) ||
                             (view.y < today0.getFullYear());

    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(function (n) {
      var c = document.createElement('div'); c.className = 'cal-dow'; c.textContent = n; c.setAttribute('aria-hidden', 'true'); grid.appendChild(c);
    });
    var startDow = new Date(view.y, view.m, 1).getDay();
    var days = new Date(view.y, view.m + 1, 0).getDate();
    for (var b = 0; b < startDow; b++) { var bl = document.createElement('div'); bl.className = 'cal-blank'; grid.appendChild(bl); }

    for (var d = 1; d <= days; d++) {
      var date = new Date(view.y, view.m, d);
      var k = keyOf(view.y, view.m, d);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day' + (isToday(k) ? ' today' : '') + (state.date === k ? ' selected' : '');
      btn.textContent = d;
      btn.setAttribute('aria-label', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      btn.setAttribute('aria-pressed', state.date === k ? 'true' : 'false');
      if (date < today0) btn.disabled = true;           // no past dates
      else btn.addEventListener('click', (function (key) { return function () { selectDate(key); }; })(k));
      grid.appendChild(btn);
    }
  }

  $('#calPrev').addEventListener('click', function () {
    view.m--; if (view.m < 0) { view.m = 11; view.y--; }
    renderCalendar();
  });
  $('#calNext').addEventListener('click', function () {
    view.m++; if (view.m > 11) { view.m = 0; view.y++; }
    renderCalendar();
  });

  function selectDate(k) {
    state.date = k;
    // a time that has already passed today is no longer valid
    if (state.time && !timeAllowed(state.time)) state.time = null;
    renderCalendar(); renderTimes(); updateNext3();
  }

  /* 10:00 – 22:30 in 30 min steps */
  var SLOTS = [];
  for (var hr = 10; hr <= 22; hr++) { SLOTS.push(pad2(hr) + ':00'); SLOTS.push(pad2(hr) + ':30'); }

  function fmtTime(t) {
    var p = t.split(':'), h = +p[0], m = p[1];
    return ((h % 12) || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function timeAllowed(t) {
    if (!state.date) return true;
    if (!isToday(state.date)) return true;
    var now = new Date(), p = t.split(':');
    return (+p[0] * 60 + +p[1]) > (now.getHours() * 60 + now.getMinutes());
  }

  function renderTimes() {
    var grid = $('#timeGrid');
    grid.textContent = '';
    SLOTS.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'time-chip';
      btn.textContent = fmtTime(t);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', state.time === t ? 'true' : 'false');
      if (!timeAllowed(t)) btn.disabled = true;
      else btn.addEventListener('click', function () { state.time = t; renderTimes(); updateNext3(); });
      grid.appendChild(btn);
    });
  }

  function validDateTime() {
    if (!state.date || !state.time) return false;
    if (parseKey(state.date) < today0) return false;
    return timeAllowed(state.time);
  }
  function updateNext3() {
    var ok = validDateTime();
    $('#next3').disabled = !ok;
    var msg = '';
    if (!state.date && !state.time) msg = 'Pick a date and a time to continue 💭';
    else if (!state.date) msg = 'Now pick a date 📅';
    else if (!state.time) msg = 'Now pick a time 🕰️';
    else msg = 'Perfect – ' + fmtDate(state.date) + ' at ' + fmtTime(state.time) + ' 💗';
    $('#hint3').textContent = msg;
  }
  $('#back3').addEventListener('click', function () { go(2); });
  $('#next3').addEventListener('click', function () { if (validDateTime()) go(4); else updateNext3(); });

  /* =========================================================
     STEPS 4 & 5 – OPTION CARDS
     ========================================================= */
  function renderOptions(gridId, items, key) {
    var grid = $('#' + gridId);
    grid.textContent = '';
    items.forEach(function (it) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', state[key] === it.id ? 'true' : 'false');
      btn.style.setProperty('--art-a', it.a);
      btn.style.setProperty('--art-b', it.b);

      var art = document.createElement('div'); art.className = 'art'; art.setAttribute('aria-hidden', 'true');
      var emoji = document.createElement('span'); emoji.textContent = it.art; art.appendChild(emoji);
      var label = document.createElement('div'); label.className = 'label'; label.textContent = it.label + ' ' + it.tag;
      var check = document.createElement('div'); check.className = 'check'; check.setAttribute('aria-hidden', 'true'); check.textContent = '✓';
      btn.appendChild(check); btn.appendChild(art); btn.appendChild(label);

      btn.addEventListener('click', function () {
        state[key] = it.id;
        Array.prototype.forEach.call(grid.children, function (c) { c.setAttribute('aria-checked', 'false'); });
        btn.setAttribute('aria-checked', 'true');
        if (key === 'food') updateNext('next4', 'hint4', state.food, '');
        else updateNext('next5', 'hint5', state.activity, '');
      });
      grid.appendChild(btn);
    });
  }

  function updateNext(btnId, hintId, value, emptyMsg) {
    $('#' + btnId).disabled = !value;
    $('#' + hintId).textContent = value ? 'Great choice 💗' : emptyMsg;
  }

  $('#back4').addEventListener('click', function () { go(3); });
  $('#next4').addEventListener('click', function () { if (state.food) go(5); });
  $('#back5').addEventListener('click', function () { go(4); });
  $('#next5').addEventListener('click', function () { if (state.activity) go(6); });

  /* =========================================================
     STEPS 6 & 7 – SUMMARY & FINALE
     ========================================================= */
  function fmtDate(k) {
    return parseKey(k).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function renderSummary(listId) {
    var list = $('#' + listId);
    list.textContent = '';
    var food = find(FOODS, state.food), act = find(ACTIVITIES, state.activity);
    var rows = [
      ['📅', 'Date', state.date ? fmtDate(state.date) : '—'],
      ['🕰️', 'Time', state.time ? fmtTime(state.time) : '—'],
      ['🍽️', 'Food', food ? food.label + ' ' + food.tag : '—'],
      ['🌷', 'Activity', act ? act.label + ' ' + act.tag : '—']
    ];
    rows.forEach(function (r) {
      var li = document.createElement('li');
      var ico = document.createElement('div'); ico.className = 'ico'; ico.setAttribute('aria-hidden', 'true'); ico.textContent = r[0];
      var box = document.createElement('div');
      var k = document.createElement('div'); k.className = 'k'; k.textContent = r[1];
      var v = document.createElement('div'); v.className = 'v'; v.textContent = r[2];
      box.appendChild(k); box.appendChild(v);
      li.appendChild(ico); li.appendChild(box);
      list.appendChild(li);
    });
  }

  $('#back6').addEventListener('click', function () { go(5); });

  /* ---------- Personal note ---------- */
  var msgBox = $('#message6'), msgCount = $('#count6');
  function updateCount() { msgCount.textContent = msgBox.value.length + ' / ' + msgBox.maxLength; }
  msgBox.addEventListener('input', function () { state.message = msgBox.value; updateCount(); });

  /* ---------- Saving the plan (PHP + MySQL via fetch) ---------- */
  var API_URL = 'api/save_response.php';
  var saveBtn = $('#confirm6'), saveErr = $('#saveError'), savedBadge = $('#savedBadge');
  var SAVE_LABEL = saveBtn.textContent;
  var saving = false;                           // blocks repeated clicks while a request is in flight

  function showSaveError(text) { saveErr.textContent = text; saveErr.hidden = false; }
  function hideSaveError() { saveErr.hidden = true; saveErr.textContent = ''; }
  function setSaving(on) {
    saving = on;
    saveBtn.disabled = on;
    saveBtn.classList.toggle('is-loading', on);
    saveBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    saveBtn.textContent = on ? 'SAVING… 💌' : SAVE_LABEL;
    $('#back6').disabled = on;
    msgBox.disabled = on;
  }

  function timeZoneName() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }

  saveBtn.addEventListener('click', function () {
    if (saving) return;                         // ignore double clicks

    // final safety validation before the big finale
    if (!validDateTime() || !state.food || !state.activity) { go(!validDateTime() ? 3 : (!state.food ? 4 : 5)); return; }
    if (state.saved) { go(7); return; }         // already stored – never insert twice

    hideSaveError();
    setSaving(true);

    var payload = {
      token: state.submissionId,
      invitation_status: 'accepted',
      selected_date: state.date,                // "YYYY-MM-DD"
      selected_time: state.time,                // "HH:MM"
      selected_food: state.food,                // option id, e.g. "pizza"
      selected_activity: state.activity,        // option id, e.g. "cinema"
      additional_message: state.message,
      timezone: timeZoneName()
    };

    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = JSON.parse(text); } catch (e) { /* not JSON – handled below */ }
          return data;
        });
      })
      .then(function (data) {
        if (data && data.ok === true) {         // only the server's confirmation counts as "saved"
          state.saved = true;
          setSaving(false);
          go(7);
        } else {
          setSaving(false);
          showSaveError((data && data.message) ||
            "Hmm, the server didn't answer the way I expected. Your choices are safe, so please try again. 💗");
        }
      })
      .catch(function (err) {
        setSaving(false);
        showSaveError(err && err.name === 'AbortError'
          ? "That took too long. Your choices are still here, so please try again. 💗"
          : "I couldn't reach the server right now. Your choices are still here, so please try again in a moment. 💗");
      })
      .then(function () { clearTimeout(timer); });
  });

  $('#restart').addEventListener('click', function () {
    state.date = state.time = state.food = state.activity = null;
    state.message = ''; state.saved = false; state.submissionId = newToken();
    msgBox.value = ''; hideSaveError();
    view.y = today0.getFullYear(); view.m = today0.getMonth(); view.shown = false;
    escapes = 0; noMsg.textContent = ''; yesBtn.style.transform = '';
    go(1);
  });

  /* =========================================================
     INIT
     ========================================================= */
  sizeCanvas();
  updateDots(1);
  requestAnimationFrame(placeNoAtSlot);
  window.addEventListener('load', placeNoAtSlot);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (state.step === 1) placeNoAtSlot(); });
})();
