(function () {
  'use strict';

  // Alt menü (mobil)
  var toggle = document.querySelector('.nav-toggle');
  var hasPuzzle = !!document.getElementById('board');
  var nav = document.getElementById('nav');
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  if (hasPuzzle) {
  // Mat bulmacası: beyaz Re1-e8# oynar (arka sıra matı)
  var GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  var START = {
    g1: 'wK', e1: 'wR', f2: 'wP', g2: 'wP', h2: 'wP',
    g8: 'bK', f7: 'bP', g7: 'bP', h7: 'bP', b7: 'bB', a6: 'bP'
  };
  var SOLUTION = { from: 'e1', to: 'e8' };
  var FILES = 'abcdefgh';

  var boardEl = document.getElementById('board');
  var msgEl = document.getElementById('puzzle-msg');
  var pos, selected, solved;

  function reset() {
    pos = Object.assign({}, START);
    selected = null;
    solved = false;
    msgEl.textContent = 'Hamle sırası sende.';
    render();
  }

  function name(sq) {
    var p = pos[sq];
    if (!p) return 'boş kare ' + sq;
    var color = p[0] === 'w' ? 'beyaz' : 'siyah';
    var kind = { K: 'şah', Q: 'vezir', R: 'kale', B: 'fil', N: 'at', P: 'piyon' }[p[1]];
    return color + ' ' + kind + ' ' + sq;
  }

  function render(hintSq) {
    boardEl.innerHTML = '';
    for (var r = 8; r >= 1; r--) {
      for (var f = 0; f < 8; f++) {
        var sq = FILES[f] + r;
        var light = (f + r) % 2 === 1;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sq ' + (light ? 'l' : 'd');
        b.dataset.sq = sq;
        b.setAttribute('aria-label', name(sq));
        if (sq === selected) b.classList.add('sel');
        if (sq === hintSq) b.classList.add('hint');
        if (solved && pos[sq] === 'bK') b.classList.add('mate');
        var p = pos[sq];
        if (p) {
          var s = document.createElement('span');
          s.className = 'pc ' + p[0];
          s.textContent = GLYPH[p[1]];
          b.appendChild(s);
        }
        boardEl.appendChild(b);
      }
    }
  }

  boardEl.addEventListener('click', function (e) {
    if (solved) return;
    var btn = e.target.closest('.sq');
    if (!btn) return;
    var sq = btn.dataset.sq;
    var piece = pos[sq];

    if (!selected) {
      if (piece && piece[0] === 'w') {
        selected = sq;
        msgEl.textContent = 'Şimdi gideceği kareyi seç.';
        render();
      } else {
        msgEl.textContent = 'Önce bir beyaz taş seç.';
      }
      return;
    }

    if (sq === selected) {
      selected = null;
      msgEl.textContent = 'Hamle sırası sende.';
      render();
      return;
    }
    if (piece && piece[0] === 'w') {
      selected = sq;
      render();
      return;
    }

    if (selected === SOLUTION.from && sq === SOLUTION.to) {
      pos[sq] = pos[selected];
      delete pos[selected];
      selected = null;
      solved = true;
      msgEl.textContent = 'Mat! Kale e8\'e gitti ve siyah şahın kaçacak karesi kalmadı. Tebrikler!';
      render();
    } else {
      selected = null;
      msgEl.textContent = 'Bu hamle mat değil. Tekrar dene ya da ipucu al.';
      render();
    }
  });

  document.getElementById('hint').addEventListener('click', function () {
    if (solved) return;
    selected = null;
    msgEl.textContent = 'İpucu: kale arka sırayı kullanabilir.';
    render(SOLUTION.from);
  });
  document.getElementById('reset').addEventListener('click', reset);
  reset();

  }

  if (document.getElementById('signup-form')) {
  // Ön kayıt formu -> WhatsApp
  var form = document.getElementById('signup-form');
  var err = document.getElementById('form-error');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(form);
    var ad = (d.get('ad') || '').toString().trim();
    var yas = (d.get('yas') || '').toString().trim();
    if (!ad || !yas) {
      err.textContent = 'Lütfen adınızı ve çocuğun yaşını yazın.';
      return;
    }
    err.textContent = '';
    var text = 'Merhaba, ben ' + ad + '. ' + yas + ' yaşındaki çocuğum için ' +
      d.get('program') + ' deneme dersi hakkında bilgi almak istiyorum. Şube: ' + d.get('sube') + '.';
    window.open('https://wa.me/905337771899?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
  }
})();

// Kaydırma ve üzerine gelme animasyonları
(function () {
  'use strict';

  // Menü: üzerine gelince kalınlaşan yazı için ölçü yer tutucusu
  document.querySelectorAll('.nav a:not(.nav-cta)').forEach(function (a) {
    a.setAttribute('data-text', a.textContent.trim());
  });

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-anim');

  // Başlık kelime kelime yükselir
  var h1 = document.querySelector('h1');
  if (h1) {
    var words = h1.textContent.trim().split(/\s+/);
    h1.setAttribute('aria-label', h1.textContent.trim());
    h1.innerHTML = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = w;
      h1.appendChild(s);
      if (i < words.length - 1) h1.appendChild(document.createTextNode(' '));
    });
  }

  // Kaydırınca beliren öğeler
  var targets = document.querySelectorAll(
    '.lead,.hero-actions,.section-title,.tile,.puzzle-text>*,.board,.fact,.news-item,.news-detail,.branch,.staff,.story-inner>*,.signup-inner>*,.club-inner>*,.page-hero p'
  );
  var groups = new Map();
  targets.forEach(function (el) {
    var n = groups.get(el.parentNode) || 0;
    groups.set(el.parentNode, n + 1);
    el.classList.add('reveal');
    el.style.setProperty('--d', Math.min(n, 5) * 0.09 + 's');
    if (/\b(tile|branch|staff|news-item)\b/.test(el.className)) el.classList.add('lift');
  });

  function countUp(el) {
    var m = el.textContent.trim().match(/^(\d+)(.*)$/);
    if (!m) return;
    var end = parseInt(m[1], 10), suffix = m[2], t0 = null, dur = 1300;
    function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * e) + (p < 1 ? '' : suffix);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add('in');
      var num = el.querySelector && el.querySelector('.fact-num');
      if (num) countUp(num);
      var delay = parseFloat(el.style.getPropertyValue('--d')) || 0;
      setTimeout(function () { el.classList.add('done'); }, 800 + delay * 1000);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(function (el) { io.observe(el); });

  // Kaydırma: üst çubuk gölgesi, damalı şerit ve logo plaketi paralaksı
  var header = document.querySelector('.site-header');
  var flags = document.querySelectorAll('.flag');
  var plaque = document.querySelector('.plaque');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || 0;
    if (header) header.classList.toggle('scrolled', y > 20);
    flags.forEach(function (f) { f.style.backgroundPosition = (-y * 0.35) + 'px 0'; });
    if (plaque) plaque.style.setProperty('--py', Math.min(y * 0.08, 40) + 'px');
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();
})();
