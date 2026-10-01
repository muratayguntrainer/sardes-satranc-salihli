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
