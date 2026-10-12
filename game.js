/* Sardes Satranç: oyun ekranı. Motor için engine.js, hesaplama için worker.js kullanılır. */
(function () {
  'use strict';
  var E = window.SardesChess;
  var FILES = 'abcdefgh';
  var PIECE_CH = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  var LEVEL_NAMES = ['', 'Acemi', 'Çaylak', 'Öğrenci', 'Gelişen', 'Orta', 'Orta üstü', 'İleri', 'Güçlü', 'Uzman', 'Usta'];
  var START_COUNTS = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
  var STORE = 'sardesChessV1';

  var boardEl = document.getElementById('board');
  var statusEl = document.getElementById('status');
  var movesEl = document.getElementById('moves');
  var levelsEl = document.getElementById('levels');
  var lvlName = document.getElementById('lvl-name');
  var colorsEl = document.getElementById('colors');
  var undoBtn = document.getElementById('undo');

  var game, human, level = 3, colorChoice = 'w', flipped = false;
  var selected = -1, targets = [], lastMove = 0, history = [], keys = [];
  var thinking = false, over = false, reqId = 0, worker = null, workerOK = true;

  // ---------- Kayıt ----------
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        level: level, color: colorChoice, human: human, flipped: flipped,
        moves: history.map(function (h) { return E.uci(h.m); })
      }));
    } catch (e) {}
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }

  // ---------- Yardımcılar ----------
  function pieceSrc(p) { return 'pieces/' + (p > 0 ? 'w' : 'b') + PIECE_CH[Math.abs(p)] + '.svg'; }
  function sqLabel(sq) { return E.sqName(sq); }
  function humanTurn() { return game.side === human; }

  // ---------- Çizim ----------
  function render() {
    var bottomWhite = (human === 1) !== flipped;
    var ranks = bottomWhite ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    var files = bottomWhite ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    var checkSq = -1;
    if (game.inCheck(game.side)) checkSq = game.ks[game.side === 1 ? 0 : 1];
    var lf = lastMove ? E.mFrom(lastMove) : -1, lt = lastMove ? E.mTo(lastMove) : -1;
    var frag = document.createDocumentFragment();
    ranks.forEach(function (r, ri) {
      files.forEach(function (f, fi) {
        var sq = r * 16 + f, p = game.b[sq];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sq ' + (((r + f) & 1) ? 'l' : 'd');
        b.dataset.sq = sq;
        var desc = p ? ((p > 0 ? 'beyaz ' : 'siyah ') + ['', 'piyon', 'at', 'fil', 'kale', 'vezir', 'şah'][Math.abs(p)] + ' ') : 'boş kare ';
        b.setAttribute('aria-label', desc + sqLabel(sq));
        if (sq === lf || sq === lt) b.classList.add('last');
        if (sq === selected) b.classList.add('sel');
        if (sq === checkSq) b.classList.add('check');
        if (targets.indexOf(sq) >= 0) b.classList.add(p ? 'cap' : 'dot');
        if (p) {
          var img = document.createElement('img');
          img.src = pieceSrc(p); img.alt = ''; img.draggable = false;
          b.appendChild(img);
        }
        if (fi === 0 || ri === 7) {
          var c = document.createElement('span');
          c.className = 'coord';
          c.textContent = (fi === 0 ? (r + 1) : '') + (ri === 7 ? FILES[f] : '');
          b.appendChild(c);
        }
        frag.appendChild(b);
      });
    });
    boardEl.innerHTML = '';
    boardEl.appendChild(frag);
    renderPlayers();
    renderMoves();
    undoBtn.disabled = !canUndo();
  }

  function renderPlayers() {
    var bottomWhite = (human === 1) !== flipped;
    var bottomIsHuman = (bottomWhite ? 1 : -1) === human;
    var botName = 'Bilgisayar · Seviye ' + level + ' (' + LEVEL_NAMES[level] + ')';
    document.getElementById('who-bottom').textContent = bottomIsHuman ? 'Sen' : botName;
    document.getElementById('who-top').textContent = bottomIsHuman ? botName : 'Sen';
    // Alınan taşlar
    var cnt = { 1: {}, '-1': {} }, p, i, sq;
    for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
      p = game.b[r * 16 + f];
      if (p && Math.abs(p) < 6) cnt[p > 0 ? 1 : -1][Math.abs(p)] = (cnt[p > 0 ? 1 : -1][Math.abs(p)] || 0) + 1;
    }
    function capturedBy(color) { // color'ın aldığı (karşı rengin eksik) taşlar
      var opp = -color, out = [];
      [5, 4, 3, 2, 1].forEach(function (t) {
        var missing = START_COUNTS[t] - (cnt[opp][t] || 0);
        for (i = 0; i < missing; i++) out.push((opp > 0 ? 'w' : 'b') + PIECE_CH[t]);
      });
      return out;
    }
    function fill(el, color) {
      el.innerHTML = '';
      capturedBy(color).forEach(function (n) {
        var img = document.createElement('img'); img.src = 'pieces/' + n + '.svg'; img.alt = ''; el.appendChild(img);
      });
    }
    fill(document.getElementById('caps-bottom'), bottomWhite ? 1 : -1);
    fill(document.getElementById('caps-top'), bottomWhite ? -1 : 1);
  }

  function renderMoves() {
    movesEl.innerHTML = '';
    for (var i = 0; i < history.length; i += 2) {
      var li = document.createElement('li');
      li.textContent = history[i].san + (history[i + 1] ? '  ' + history[i + 1].san : '');
      movesEl.appendChild(li);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
    // Beyaz ilk hamle ile başlamadıysa (siyah oynuyorsa) numaralandırma yine doğru: ol başlangıç beyaz
  }

  function setStatus(t) { statusEl.textContent = t; }

  // ---------- Oyun sonu ----------
  function endState() {
    var moves = game.moves();
    if (!moves.length) {
      if (game.inCheck(game.side)) return game.side === human ? 'Şah mat. Bilgisayar kazandı.' : 'Şah mat! Tebrikler, kazandın!';
      return 'Pat. Oyun berabere bitti.';
    }
    if (game.insufficient()) return 'Yetersiz materyal. Oyun berabere bitti.';
    if (game.half >= 100) return '50 hamle kuralı. Oyun berabere bitti.';
    var k = keys[keys.length - 1], n = 0;
    keys.forEach(function (x) { if (x === k) n++; });
    if (n >= 3) return 'Üç kez tekrar. Oyun berabere bitti.';
    return '';
  }

  function afterMove() {
    var msg = endState();
    if (msg) { over = true; setStatus(msg); render(); save(); return; }
    save();
    if (humanTurn()) {
      setStatus(game.inCheck(game.side) ? 'Şah çekildi! Hamle sırası sende.' : 'Hamle sırası sende.');
      render();
    } else {
      render();
      aiTurn();
    }
  }

  function apply(m) {
    var s = game.san(m);
    game.make(m);
    history.push({ m: m, san: s });
    keys.push(game.key());
    lastMove = m; selected = -1; targets = [];
  }

  // ---------- Yapay zeka ----------
  function ensureWorker() {
    if (!workerOK) return null;
    if (worker) return worker;
    try {
      worker = new Worker('worker.js');
      worker.onerror = function () { workerOK = false; worker = null; if (thinking) runFallback(pending); };
      worker.onmessage = function (e) {
        if (e.data.id !== reqId) return;
        if (e.data.error) { workerOK = false; worker = null; runFallback(pending); return; }
        finishAI(e.data.uci);
      };
    } catch (err) { workerOK = false; worker = null; }
    return worker;
  }

  var pending = null;
  function aiTurn() {
    thinking = true;
    setStatus('Bilgisayar düşünüyor…');
    pending = { fen: game.fen(), level: level };
    var id = ++reqId;
    var w = ensureWorker();
    if (w) w.postMessage({ id: id, fen: pending.fen, level: pending.level });
    else runFallback(pending);
  }
  function runFallback(p) {
    var id = reqId;
    setTimeout(function () {
      if (id !== reqId) return;
      var g = new E.Game(p.fen);
      var m = E.bestMove(g, p.level);
      finishAI(m ? E.uci(m) : '');
    }, 40);
  }
  function finishAI(u) {
    if (!thinking) return;
    thinking = false;
    if (!u) { afterMove(); return; }
    var from = E.sqOf(u.slice(0, 2)), to = E.sqOf(u.slice(2, 4));
    var promo = u.length > 4 ? { q: 5, r: 4, b: 3, n: 2 }[u[4]] : 0;
    var m = game.find(from, to, promo);
    if (!m) { setStatus('Bilgisayar hamle bulamadı.'); return; }
    apply(m);
    afterMove();
  }
  function cancelAI() {
    reqId++; thinking = false;
    if (worker) { try { worker.terminate(); } catch (e) {} worker = null; }
  }

  // ---------- Oyuncu hamlesi ----------
  boardEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.sq');
    if (!btn || over || thinking || !humanTurn()) return;
    var sq = parseInt(btn.dataset.sq, 10), p = game.b[sq];
    if (selected >= 0 && targets.indexOf(sq) >= 0) { tryMove(selected, sq); return; }
    if (p && (p > 0) === (human > 0)) {
      selected = sq;
      targets = game.moves().filter(function (m) { return E.mFrom(m) === sq; }).map(E.mTo);
    } else { selected = -1; targets = []; }
    render();
  });

  function tryMove(from, to) {
    var cands = game.moves().filter(function (m) { return E.mFrom(m) === from && E.mTo(m) === to; });
    if (!cands.length) return;
    if (cands.length > 1) { askPromotion(cands, function (m) { apply(m); afterMove(); }); return; }
    apply(cands[0]);
    afterMove();
  }

  function askPromotion(cands, cb) {
    var modal = document.getElementById('promo'), row = document.getElementById('promo-row');
    row.innerHTML = '';
    var names = { 5: 'Vezir', 4: 'Kale', 3: 'Fil', 2: 'At' };
    [5, 4, 3, 2].forEach(function (t) {
      var m = cands.filter(function (c) { return E.mPromo(c) === t; })[0];
      if (!m) return;
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', names[t]);
      var img = document.createElement('img');
      img.src = 'pieces/' + (human > 0 ? 'w' : 'b') + PIECE_CH[t] + '.svg'; img.alt = '';
      b.appendChild(img);
      b.addEventListener('click', function () { modal.hidden = true; cb(m); });
      row.appendChild(b);
    });
    modal.hidden = false;
    row.firstChild.focus();
  }

  // ---------- Düğmeler ----------
  function canUndo() {
    if (thinking) return false;
    var floor = human === 1 ? 0 : 1; // siyah oynarken bilgisayarın ilk hamlesi geri alınmaz
    return history.length - 2 >= floor && (humanTurn() || over);
  }
  undoBtn.addEventListener('click', function () {
    if (!canUndo()) return;
    // Oyun bittiyse ve sıra bilgisayardaysa tek hamle, aksi halde iki hamle geri
    var n = humanTurn() ? 2 : 1;
    while (n-- > 0 && history.length) { game.unmake(); history.pop(); keys.pop(); }
    lastMove = history.length ? history[history.length - 1].m : 0;
    selected = -1; targets = []; over = false;
    setStatus('Hamle sırası sende.');
    render(); save();
  });
  document.getElementById('flip').addEventListener('click', function () { flipped = !flipped; render(); save(); });
  document.getElementById('new').addEventListener('click', function () { newGame(); });

  levelsEl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    level = parseInt(b.dataset.l, 10); syncControls(); renderPlayers(); save();
  });
  colorsEl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    colorChoice = b.dataset.c; syncControls(); save();
  });

  function syncControls() {
    Array.prototype.forEach.call(levelsEl.children, function (b) { b.setAttribute('aria-pressed', String(parseInt(b.dataset.l, 10) === level)); });
    lvlName.textContent = level + ' · ' + LEVEL_NAMES[level];
    Array.prototype.forEach.call(colorsEl.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.c === colorChoice)); });
  }

  function newGame(saved) {
    cancelAI();
    game = new E.Game();
    history = []; keys = [game.key()]; lastMove = 0; selected = -1; targets = []; over = false; flipped = false;
    human = colorChoice === 'w' ? 1 : colorChoice === 'b' ? -1 : (Math.random() < 0.5 ? 1 : -1);
    if (saved) {
      human = saved.human || human; flipped = !!saved.flipped;
      (saved.moves || []).forEach(function (u) {
        var m = game.find(E.sqOf(u.slice(0, 2)), E.sqOf(u.slice(2, 4)), u.length > 4 ? { q: 5, r: 4, b: 3, n: 2 }[u[4]] : 0);
        if (m) apply(m);
      });
    }
    syncControls();
    var msg = endState();
    if (msg) { over = true; setStatus(msg); render(); save(); return; }
    if (humanTurn()) { setStatus(history.length ? 'Hamle sırası sende.' : 'Oyun başladı. Beyaz oynuyor.'); render(); save(); }
    else { render(); save(); aiTurn(); }
  }

  // ---------- Telefona kurulum ----------
  var deferred = null, installEl = document.getElementById('install'), installBtn = document.getElementById('install-btn');
  var installText = document.getElementById('install-text');
  function standalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (standalone()) return;
    installText.textContent = 'Bu oyunu telefonunuza uygulama gibi kurabilirsiniz. İnternet olmadan da çalışır.';
    installBtn.hidden = false; installEl.hidden = false;
  });
  installBtn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; installEl.hidden = true; });
  });
  window.addEventListener('appinstalled', function () { installEl.hidden = true; });
  if (!standalone() && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    installText.textContent = 'iPhone ve iPad\'e kurmak için Safari\'de Paylaş düğmesine, sonra "Ana Ekrana Ekle"ye dokunun.';
    installEl.hidden = false;
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // ---------- Başlangıç ----------
  for (var i = 1; i <= 10; i++) {
    var b = document.createElement('button');
    b.type = 'button'; b.dataset.l = i; b.textContent = i;
    b.setAttribute('aria-label', 'Seviye ' + i + ', ' + LEVEL_NAMES[i]);
    levelsEl.appendChild(b);
  }
  var saved = loadSaved();
  if (saved) { level = saved.level || level; colorChoice = saved.color || colorChoice; }
  newGame(saved && saved.moves && saved.moves.length ? saved : null);
})();
