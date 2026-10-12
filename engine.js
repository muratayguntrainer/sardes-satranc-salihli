/* Sardes Satranç motoru: kurallar (rok, en passant, terfi), şah/mat/pat tespiti ve 10 seviyeli yapay zeka.
   Dış kütüphane gerektirmez. Tarayıcıda, Web Worker içinde ve Node.js'te çalışır. */
(function (root) {
  'use strict';

  var P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var KN = [-33, -31, -18, -14, 14, 18, 31, 33];
  var KG = [-17, -16, -15, -1, 1, 15, 16, 17];
  var BDIR = [-17, -15, 15, 17];
  var RDIR = [-16, -1, 1, 16];
  var CMASK = new Int8Array(128);
  CMASK[0] = 2; CMASK[4] = 3; CMASK[7] = 1; CMASK[112] = 8; CMASK[116] = 12; CMASK[119] = 4;
  var FILES = 'abcdefgh';
  var LETTER = { 1: '', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  var CH = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
  var CHR = ' pnbrqk';

  function sqName(s) { return FILES[s & 7] + ((s >> 4) + 1); }
  function sqOf(n) { return (parseInt(n[1], 10) - 1) * 16 + FILES.indexOf(n[0]); }
  function mk(from, to, promo, flags) { return from | (to << 7) | ((promo || 0) << 14) | ((flags || 0) << 17); }
  function mFrom(m) { return m & 127; }
  function mTo(m) { return (m >> 7) & 127; }
  function mPromo(m) { return (m >> 14) & 7; }
  function mFlags(m) { return m >> 17; }
  function uci(m) { return sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? CHR[mPromo(m)] : ''); }

  function Game(fen) {
    this.b = new Int8Array(128);
    this.ks = [4, 116];
    this.uM = new Int32Array(4096);
    this.uCap = new Int8Array(4096);
    this.uCastle = new Int8Array(4096);
    this.uEp = new Int16Array(4096);
    this.uHalf = new Int16Array(4096);
    this.n = 0;
    this.load(fen || START);
  }

  Game.prototype.load = function (fen) {
    var f = fen.trim().split(/\s+/), rows = f[0].split('/'), r, i, ch, file;
    this.b.fill(0);
    for (r = 0; r < 8; r++) {
      file = 0;
      for (i = 0; i < rows[r].length; i++) {
        ch = rows[r][i];
        if (/\d/.test(ch)) { file += parseInt(ch, 10); continue; }
        var low = ch.toLowerCase(), sq = (7 - r) * 16 + file;
        this.b[sq] = (ch === low ? -1 : 1) * CH[low];
        if (low === 'k') this.ks[ch === low ? 1 : 0] = sq;
        file++;
      }
    }
    this.side = f[1] === 'b' ? -1 : 1;
    var c = f[2] || '-';
    this.castle = (c.indexOf('K') >= 0 ? 1 : 0) | (c.indexOf('Q') >= 0 ? 2 : 0) | (c.indexOf('k') >= 0 ? 4 : 0) | (c.indexOf('q') >= 0 ? 8 : 0);
    this.ep = f[3] && f[3] !== '-' ? sqOf(f[3]) : -1;
    this.half = parseInt(f[4] || '0', 10);
    this.full = parseInt(f[5] || '1', 10);
    this.n = 0;
  };

  Game.prototype.fen = function () {
    var out = [], r, f, e, p, s;
    for (r = 7; r >= 0; r--) {
      s = ''; e = 0;
      for (f = 0; f < 8; f++) {
        p = this.b[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        s += p > 0 ? CHR[p].toUpperCase() : CHR[-p];
      }
      if (e) s += e;
      out.push(s);
    }
    var c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return out.join('/') + ' ' + (this.side === 1 ? 'w' : 'b') + ' ' + (c || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  };

  // Konum anahtarı (tekrar tespiti için): taşlar, sıra, rok hakkı, en passant
  Game.prototype.key = function () { return this.fen().split(' ').slice(0, 4).join(' '); };

  Game.prototype.attacked = function (sq, by) {
    var b = this.b, i, s, p, d;
    if (by === 1) {
      s = sq - 15; if (!(s & 0x88) && b[s] === 1) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === 1) return true;
    } else {
      s = sq + 15; if (!(s & 0x88) && b[s] === -1) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === -1) return true;
    }
    for (i = 0; i < 8; i++) { s = sq + KN[i]; if (!(s & 0x88) && b[s] === by * 2) return true; }
    for (i = 0; i < 8; i++) { s = sq + KG[i]; if (!(s & 0x88) && b[s] === by * 6) return true; }
    for (i = 0; i < 4; i++) {
      d = BDIR[i]; s = sq + d;
      while (!(s & 0x88)) { p = b[s]; if (p) { if (p === by * 3 || p === by * 5) return true; break; } s += d; }
    }
    for (i = 0; i < 4; i++) {
      d = RDIR[i]; s = sq + d;
      while (!(s & 0x88)) { p = b[s]; if (p) { if (p === by * 4 || p === by * 5) return true; break; } s += d; }
    }
    return false;
  };

  Game.prototype.inCheck = function (side) {
    side = side || this.side;
    return this.attacked(this.ks[side === 1 ? 0 : 1], -side);
  };

  // Sözde yasal hamleler. caps=true ise yalnızca alma ve terfi hamleleri.
  Game.prototype.gen = function (caps) {
    var out = [], b = this.b, side = this.side, from, p, t, to, d, i, q, dir, dx, s;
    for (from = 0; from < 120; from++) {
      if (from & 0x88) { from += 7; continue; }
      p = b[from];
      if (!p || (p > 0) !== (side > 0)) continue;
      t = p * side;
      if (t === 1) {
        dir = 16 * side;
        var promoRank = side === 1 ? 6 : 1, startRank = side === 1 ? 1 : 6, rk = from >> 4;
        to = from + dir;
        if (!(to & 0x88) && !b[to]) {
          if (rk === promoRank) { out.push(mk(from, to, Q), mk(from, to, R), mk(from, to, B), mk(from, to, N)); }
          else if (!caps) {
            out.push(mk(from, to));
            if (rk === startRank && !b[to + dir]) out.push(mk(from, to + dir, 0, 4));
          }
        }
        for (dx = -1; dx <= 1; dx += 2) {
          to = from + dir + dx;
          if (to & 0x88) continue;
          q = b[to];
          if (q && (q > 0) !== (side > 0)) {
            if (rk === promoRank) out.push(mk(from, to, Q), mk(from, to, R), mk(from, to, B), mk(from, to, N));
            else out.push(mk(from, to));
          } else if (!q && to === this.ep) out.push(mk(from, to, 0, 1));
        }
      } else if (t === 2 || t === 6) {
        var offs = t === 2 ? KN : KG;
        for (i = 0; i < 8; i++) {
          to = from + offs[i];
          if (to & 0x88) continue;
          q = b[to];
          if (!q) { if (!caps) out.push(mk(from, to)); }
          else if ((q > 0) !== (side > 0)) out.push(mk(from, to));
        }
        if (t === 6 && !caps) {
          if (side === 1 && from === 4) {
            if ((this.castle & 1) && !b[5] && !b[6] && !this.attacked(4, -1) && !this.attacked(5, -1) && !this.attacked(6, -1)) out.push(mk(4, 6, 0, 2));
            if ((this.castle & 2) && !b[3] && !b[2] && !b[1] && !this.attacked(4, -1) && !this.attacked(3, -1) && !this.attacked(2, -1)) out.push(mk(4, 2, 0, 2));
          } else if (side === -1 && from === 116) {
            if ((this.castle & 4) && !b[117] && !b[118] && !this.attacked(116, 1) && !this.attacked(117, 1) && !this.attacked(118, 1)) out.push(mk(116, 118, 0, 2));
            if ((this.castle & 8) && !b[115] && !b[114] && !b[113] && !this.attacked(116, 1) && !this.attacked(115, 1) && !this.attacked(114, 1)) out.push(mk(116, 114, 0, 2));
          }
        }
      } else {
        var dirs = t === 3 ? BDIR : (t === 4 ? RDIR : KG), nd = t === 5 ? 8 : 4;
        for (i = 0; i < nd; i++) {
          d = dirs[i]; s = from + d;
          while (!(s & 0x88)) {
            q = b[s];
            if (!q) { if (!caps) out.push(mk(from, s)); }
            else { if ((q > 0) !== (side > 0)) out.push(mk(from, s)); break; }
            s += d;
          }
        }
      }
    }
    return out;
  };

  Game.prototype.make = function (m) {
    var b = this.b, side = this.side, from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = m >> 17;
    var piece = b[from], cap = b[to], i = this.n++;
    this.uM[i] = m; this.uCastle[i] = this.castle; this.uEp[i] = this.ep; this.uHalf[i] = this.half;
    if (fl & 1) { var cs = to - 16 * side; cap = b[cs]; b[cs] = 0; }
    this.uCap[i] = cap;
    b[to] = piece; b[from] = 0;
    if (fl & 2) {
      if (to > from) { b[to - 1] = b[to + 1]; b[to + 1] = 0; }
      else { b[to + 1] = b[to - 2]; b[to - 2] = 0; }
    }
    if (promo) b[to] = side * promo;
    if (piece === side * 6) this.ks[side === 1 ? 0 : 1] = to;
    this.castle &= ~(CMASK[from] | CMASK[to]);
    this.ep = (fl & 4) ? from + 16 * side : -1;
    this.half = (piece * side === 1 || cap) ? 0 : this.half + 1;
    if (side === -1) this.full++;
    this.side = -side;
  };

  Game.prototype.unmake = function () {
    var i = --this.n, m = this.uM[i], b = this.b;
    var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = m >> 17;
    this.side = -this.side;
    var side = this.side;
    b[from] = promo ? side : b[to];
    if (fl & 1) { b[to] = 0; b[to - 16 * side] = this.uCap[i]; }
    else b[to] = this.uCap[i];
    if (fl & 2) {
      if (to > from) { b[to + 1] = b[to - 1]; b[to - 1] = 0; }
      else { b[to - 2] = b[to + 1]; b[to + 1] = 0; }
    }
    if (b[from] === side * 6) this.ks[side === 1 ? 0 : 1] = from;
    this.castle = this.uCastle[i]; this.ep = this.uEp[i]; this.half = this.uHalf[i];
    if (side === -1) this.full--;
  };

  // Yasal hamleler
  Game.prototype.moves = function () {
    var list = this.gen(false), out = [], i, me = this.side;
    for (i = 0; i < list.length; i++) {
      this.make(list[i]);
      if (!this.inCheck(me)) out.push(list[i]);
      this.unmake();
    }
    return out;
  };

  Game.prototype.find = function (from, to, promo) {
    var ms = this.moves(), i;
    for (i = 0; i < ms.length; i++) {
      if (mFrom(ms[i]) === from && mTo(ms[i]) === to && (!mPromo(ms[i]) || mPromo(ms[i]) === (promo || Q))) return ms[i];
    }
    return 0;
  };

  Game.prototype.san = function (m) {
    var b = this.b, from = mFrom(m), to = mTo(m), piece = Math.abs(b[from]), fl = mFlags(m), s = '';
    if (fl & 2) s = to > from ? 'O-O' : 'O-O-O';
    else {
      var capture = b[to] !== 0 || (fl & 1);
      if (piece === 1) {
        if (capture) s += FILES[from & 7] + 'x';
        s += sqName(to);
        if (mPromo(m)) s += '=' + LETTER[mPromo(m)];
      } else {
        s += LETTER[piece];
        var ms = this.moves(), same = [], i;
        for (i = 0; i < ms.length; i++) {
          if (ms[i] !== m && mTo(ms[i]) === to && Math.abs(b[mFrom(ms[i])]) === piece) same.push(mFrom(ms[i]));
        }
        if (same.length) {
          var sameFile = same.some(function (x) { return (x & 7) === (from & 7); });
          var sameRank = same.some(function (x) { return (x >> 4) === (from >> 4); });
          if (!sameFile) s += FILES[from & 7];
          else if (!sameRank) s += ((from >> 4) + 1);
          else s += sqName(from);
        }
        if (capture) s += 'x';
        s += sqName(to);
      }
    }
    this.make(m);
    if (this.inCheck(this.side)) s += this.moves().length ? '+' : '#';
    this.unmake();
    return s;
  };

  Game.prototype.insufficient = function () {
    var minors = [], f, r, p, b = this.b;
    for (r = 0; r < 8; r++) for (f = 0; f < 8; f++) {
      p = Math.abs(b[r * 16 + f]);
      if (p === 1 || p === 4 || p === 5) return false;
      if (p === 2 || p === 3) minors.push([p, (r + f) & 1]);
    }
    if (minors.length <= 1) return true;
    return minors.every(function (x) { return x[0] === 3 && x[1] === minors[0][1]; });
  };

  Game.prototype.perft = function (d) {
    if (d === 0) return 1;
    var ms = this.gen(false), n = 0, i, me = this.side;
    for (i = 0; i < ms.length; i++) {
      this.make(ms[i]);
      if (!this.inCheck(me)) n += d === 1 ? 1 : this.perft(d - 1);
      this.unmake();
    }
    return n;
  };

  // ---------- Değerlendirme ----------
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var PST = {
    1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  };
  var KEND = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

  function centerDist(sq) { var r = sq >> 4, f = sq & 7; return (Math.abs(2 * r - 7) + Math.abs(2 * f - 7)) >> 1; }

  Game.prototype.evaluate = function () {
    var b = this.b, score = 0, npm = 0, r, f, sq, p, t, i;
    for (r = 0; r < 8; r++) for (f = 0; f < 8; f++) {
      p = b[r * 16 + f];
      if (p) { t = p > 0 ? p : -p; if (t > 1 && t < 6) npm += VAL[t]; }
    }
    var end = npm <= 2600;
    for (r = 0; r < 8; r++) for (f = 0; f < 8; f++) {
      sq = r * 16 + f; p = b[sq];
      if (!p) continue;
      t = p > 0 ? p : -p;
      i = p > 0 ? (7 - r) * 8 + f : r * 8 + f;
      var v = VAL[t] + (t === 6 && end ? KEND[i] : PST[t][i]);
      score += p > 0 ? v : -v;
    }
    if (end) {
      var diff = score, wk = this.ks[0], bk = this.ks[1];
      var kd = Math.abs((wk >> 4) - (bk >> 4)) + Math.abs((wk & 7) - (bk & 7));
      if (diff > 200) score += 10 * centerDist(bk) + 4 * (14 - kd);
      else if (diff < -200) score -= 10 * centerDist(wk) + 4 * (14 - kd);
    }
    return this.side === 1 ? score : -score;
  };

  // ---------- Arama ----------
  var MATE = 30000, INF = 32000;
  var LEVELS = [
    null,
    { depth: 1, noise: 400, time: 300 },
    { depth: 1, noise: 200, time: 300 },
    { depth: 2, noise: 120, time: 600 },
    { depth: 2, noise: 50, time: 800 },
    { depth: 3, noise: 25, time: 1200 },
    { depth: 3, noise: 0, time: 1500 },
    { depth: 4, noise: 0, time: 2000 },
    { depth: 5, noise: 0, time: 2500 },
    { depth: 6, noise: 0, time: 3000 },
    { depth: 8, noise: 0, time: 4000 }
  ];

  function Searcher(game) {
    this.g = game; this.nodes = 0; this.deadline = 0; this.stop = false;
    this.killers = [];
    for (var i = 0; i < 64; i++) this.killers.push([0, 0]);
    this.hist = new Int32Array(128 * 128);
  }

  Searcher.prototype.order = function (list, ply, pv) {
    var g = this.g, b = g.b, sc = new Array(list.length), i, m, v, a;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (m === pv) { sc[i] = 1e7; continue; }
      v = b[mTo(m)]; a = b[mFrom(m)];
      if (v || (mFlags(m) & 1)) sc[i] = 1e6 + 10 * Math.abs(v || 1) - Math.abs(a);
      else if (mPromo(m)) sc[i] = 9e5 + mPromo(m);
      else if (this.killers[ply] && (this.killers[ply][0] === m || this.killers[ply][1] === m)) sc[i] = 8e5;
      else sc[i] = this.hist[mFrom(m) * 128 + mTo(m)];
    }
    var idx = list.map(function (_, k) { return k; }).sort(function (x, y) { return sc[y] - sc[x]; });
    return idx.map(function (k) { return list[k]; });
  };

  Searcher.prototype.tick = function () {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) { this.stop = true; throw 'timeout'; }
  };

  Searcher.prototype.qs = function (alpha, beta, qd) {
    this.tick();
    var g = this.g, stand = g.evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd <= 0) return alpha;
    var list = this.order(g.gen(true), 63, 0), me = g.side, i, sc;
    for (i = 0; i < list.length; i++) {
      g.make(list[i]);
      if (g.inCheck(me)) { g.unmake(); continue; }
      sc = -this.qs(-beta, -alpha, qd - 1);
      g.unmake();
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };

  Searcher.prototype.ab = function (depth, alpha, beta, ply) {
    this.tick();
    var g = this.g, me = g.side, chk = g.inCheck(me);
    if (g.half >= 100) return 0;
    if (chk && ply < 40) depth++;
    if (depth <= 0) return this.qs(alpha, beta, 6);
    var list = this.order(g.gen(false), ply < 64 ? ply : 63, 0), legal = 0, i, sc, m, best = -INF, quiet;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      g.make(m);
      if (g.inCheck(me)) { g.unmake(); continue; }
      legal++;
      sc = -this.ab(depth - 1, -beta, -alpha, ply + 1);
      g.unmake();
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        quiet = !g.b[mTo(m)] && !mPromo(m) && !(mFlags(m) & 1);
        if (quiet && ply < 64) {
          if (this.killers[ply][0] !== m) { this.killers[ply][1] = this.killers[ply][0]; this.killers[ply][0] = m; }
          this.hist[mFrom(m) * 128 + mTo(m)] += depth * depth;
        }
        break;
      }
    }
    if (!legal) return chk ? -MATE + ply : 0;
    return best;
  };

  function bestMove(game, level, opts) {
    opts = opts || {};
    var cfg = LEVELS[Math.max(1, Math.min(10, level | 0))] || LEVELS[5];
    var roots = game.moves();
    if (!roots.length) return 0;
    if (roots.length === 1) return roots[0];

    // Açılış çeşitliliği: ilk hamlede iyi bilinen birkaç hamleden biri
    if (game.full === 1 && game.side === 1 && level >= 3 && game.n === 0 && game.fen().indexOf(START.split(' ')[0]) === 0) {
      var picks = ['e2e4', 'd2d4', 'g1f3', 'c2c4'], pk = picks[Math.floor(Math.random() * picks.length)];
      for (var z = 0; z < roots.length; z++) if (uci(roots[z]) === pk) return roots[z];
    }

    var base = game.n, s = new Searcher(game), i, sc, me = game.side;
    var timeMs = opts.time || cfg.time;
    s.deadline = Date.now() + timeMs;

    if (cfg.noise > 0) {
      // Zayıf seviyeler: her hamleyi değerlendir, puana rastgele sapma ekle
      var bestM = roots[0], bestS = -Infinity;
      s.deadline = Date.now() + 5000;
      for (i = 0; i < roots.length; i++) {
        game.make(roots[i]);
        try { sc = -s.ab(cfg.depth - 1, -INF, INF, 1); } catch (e) { sc = 0; }
        while (game.n > base) game.unmake();
        sc += (Math.random() * 2 - 1) * cfg.noise;
        if (sc > bestS) { bestS = sc; bestM = roots[i]; }
      }
      return bestM;
    }

    var best = roots[0], pv = 0, d, alpha, beta, curBest, curScore;
    for (d = 1; d <= cfg.depth; d++) {
      try {
        alpha = -INF; beta = INF; curBest = 0; curScore = -INF;
        var ordered = s.order(roots, 0, pv);
        for (i = 0; i < ordered.length; i++) {
          game.make(ordered[i]);
          sc = -s.ab(d - 1, -beta, -alpha, 1);
          game.unmake();
          if (sc > curScore) { curScore = sc; curBest = ordered[i]; }
          if (sc > alpha) alpha = sc;
        }
        best = curBest; pv = curBest;
        if (curScore > MATE - 100) break;
      } catch (e) {
        // süre doldu: yarım kalan aramada açık hamleleri geri al
        while (game.n > base) game.unmake();
        break;
      }
    }
    return best;
  }

  var api = {
    Game: Game, bestMove: bestMove, LEVELS: LEVELS, START: START,
    uci: uci, sqName: sqName, sqOf: sqOf, mFrom: mFrom, mTo: mTo, mPromo: mPromo, mFlags: mFlags, mk: mk
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SardesChess = api;
})(typeof self !== 'undefined' ? self : this);
