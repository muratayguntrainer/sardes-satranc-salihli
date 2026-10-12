// Yapay zeka hamlesini sayfayı dondurmadan hesaplar
importScripts('engine.js');
self.onmessage = function (e) {
  var d = e.data;
  try {
    var g = new SardesChess.Game(d.fen);
    var m = SardesChess.bestMove(g, d.level);
    self.postMessage({ id: d.id, uci: m ? SardesChess.uci(m) : '' });
  } catch (err) {
    self.postMessage({ id: d.id, uci: '', error: String(err) });
  }
};
