<?php
/* Sardes Satranç - Instagram son gönderiler
   Instagram API ile son 9 gönderiyi çeker, 1 saat önbellekte tutar ve JSON olarak verir.
   Jeton (token) 60 günlüktür; bu dosya her çağrıda kalan süreye bakıp jetonu kendiliğinden yeniler. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=600');

$dir        = __DIR__;
$tokenFile  = $dir . '/ig-token.php';   // jeton burada saklanır (aşağıdaki biçimde)
$cacheFile  = $dir . '/ig-cache.json';
$cacheTtl   = 3600;                     // 1 saat
$limit      = 9;

function out($data, $code = 200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

// 1) taze önbellek varsa onu ver
if (is_file($cacheFile) && time() - filemtime($cacheFile) < $cacheTtl) { readfile($cacheFile); exit; }

// 2) jetonu oku
if (!is_file($tokenFile)) out(['posts' => [], 'error' => 'ig-token.php yok'], 200);
$cfg = include $tokenFile;
$token = isset($cfg['token']) ? trim($cfg['token']) : '';
if ($token === '' || $token === 'BURAYA_JETON') out(['posts' => [], 'error' => 'jeton girilmemis'], 200);
$refreshedAt = isset($cfg['refreshed_at']) ? (int)$cfg['refreshed_at'] : 0;

function http_get($url) {
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => true]);
    $r = curl_exec($ch); curl_close($ch); return $r;
  }
  return @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 10]]));
}

// 3) jetonu 30 günde bir yenile
if (time() - $refreshedAt > 30 * 86400) {
  $r = http_get('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=' . urlencode($token));
  $j = $r ? json_decode($r, true) : null;
  if ($j && !empty($j['access_token'])) {
    $token = $j['access_token'];
    $new = "<?php\nreturn " . var_export(['token' => $token, 'refreshed_at' => time()], true) . ";\n";
    @file_put_contents($tokenFile, $new, LOCK_EX);
  }
}

// 4) gönderileri çek
$fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
$r = http_get('https://graph.instagram.com/me/media?fields=' . $fields . '&limit=' . $limit . '&access_token=' . urlencode($token));
$j = $r ? json_decode($r, true) : null;

if (!$j || empty($j['data'])) {
  // hata olursa eski önbelleği (varsa) ver
  if (is_file($cacheFile)) { readfile($cacheFile); exit; }
  out(['posts' => [], 'error' => 'gonderiler alinamadi'], 200);
}

$posts = [];
foreach ($j['data'] as $p) {
  $img = ($p['media_type'] === 'VIDEO') ? (isset($p['thumbnail_url']) ? $p['thumbnail_url'] : '') : (isset($p['media_url']) ? $p['media_url'] : '');
  if (!$img || empty($p['permalink'])) continue;
  $posts[] = [
    'permalink' => $p['permalink'],
    'image'     => $img,
    'type'      => $p['media_type'],
    'caption'   => isset($p['caption']) ? mb_substr($p['caption'], 0, 140) : '',
  ];
}
$json = json_encode(['posts' => $posts], JSON_UNESCAPED_UNICODE);
@file_put_contents($cacheFile, $json, LOCK_EX);
echo $json;
