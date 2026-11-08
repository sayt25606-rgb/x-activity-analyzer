/**
 * Cloudflare Pages Functions: /share
 * クエリ例: /share?u=sama&h=0-0-1-3-5-2-0-0...
 * X (Twitter) Card / OGP メタタグ付きHTMLを生成して返す
 */
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const username = (url.searchParams.get('u') || '').replace(/^@/, '').trim();
  const hourly = url.searchParams.get('h') || '';

  const title = username ? `@${username} の活動時間帯分析` : 'X 活動時間帯チェッカー';
  const description = username
    ? `@${username} の直近100件のポスト時間帯（0〜23時）を分析しました。`
    : 'Xユーザーの直近の投稿時間帯を可視化・分析します。';

  // 動的OGP画像のURL (/api/og)
  const ogImageUrl = `${url.origin}/api/og?u=${encodeURIComponent(username)}&h=${encodeURIComponent(hourly)}`;
  const pageUrl = url.href;

  const escapeHtml = (str) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>

  <!-- OGP / Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">

  <!-- X (Twitter) Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">

  <!-- 人間（ブラウザ）がアクセスした場合はトップページへ転送して結果を表示 -->
  <script>
    window.location.replace('/' + window.location.search);
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=/${escapeHtml(url.search)}">
  </noscript>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
