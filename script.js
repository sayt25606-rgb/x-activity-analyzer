const form = document.getElementById('analyzeForm');
const usernameInput = document.getElementById('username');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultPre = document.getElementById('result');
const graphContainer = document.getElementById('graphContainer');

// 24時間の空背景カラーコード (00時〜23時)
const SKY_COLORS = [
  "#161b24", "#191f2a", "#1e2532", "#252d3d", "#3b415e", "#7d5873",
  "#d68763", "#8292a8", "#4f8cc4", "#5796cf", "#60a1db", "#6badec",
  "#74b5f2", "#6badec", "#5ea1db", "#5292c9", "#768ca8", "#d9845b",
  "#9c5d75", "#58486e", "#353e57", "#252d3d", "#1e2532", "#191f2a"
];

// --- 1. データ取得 ---
/**
 * FxTwitterのRSSフィードから投稿の公開日時（pubDate）一覧を取得する
 * @param {string} username Xのユーザー名
 * @returns {Promise<Date[]>} 投稿日時の配列
 */
async function fetchUserPosts(username) {
  const url = `https://fxtwitter.com/${encodeURIComponent(username)}/feed.xml?count=100`;
  const res = await fetch(url);

  if (res.status === 404) {
    throw new Error(`@${username} は存在しないか、鍵アカウントです。`);
  }
  if (!res.ok) {
    throw new Error(`取得エラー (HTTP ${res.status})`);
  }

  const xmlText = await res.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const items = xmlDoc.querySelectorAll('item');

  if (items.length === 0) {
    throw new Error(`@${username} の投稿が見つかりませんでした。`);
  }

  const postDates = [];
  items.forEach((item) => {
    const pubDateStr = item.querySelector('pubDate')?.textContent;
    if (pubDateStr) {
      const date = new Date(pubDateStr);
      if (!isNaN(date.getTime())) {
        postDates.push(date);
      }
    }
  });

  return postDates;
}

// --- 2. 集計・分析 ---
/**
 * 投稿日時のリストから、日本時間 (JST: 0〜23時) ごとの投稿数を集計する
 * @param {Date[]} postDates 投稿日時の配列
 * @returns {number[]} 0〜23時の件数配列 (長さ24)
 */
function aggregateHourlyJST(postDates) {
  const hourly = new Array(24).fill(0);
  postDates.forEach((date) => {
    const jstHour = (date.getUTCHours() + 9) % 24;
    hourly[jstHour] += 1;
  });
  return hourly;
}

// --- 3. 自前SVGグラフの動的生成 ---
/**
 * 24分割の空背景と棒グラフを組み合わせた完全なSVG文字列を生成する
 * @param {number[]} hourly 0〜23時の件数配列
 * @returns {string} SVGマークアップ文字列
 */
function generateGraphSvg(hourly) {
  const maxCount = Math.max(...hourly, 1);
  const peakHour = hourly.indexOf(Math.max(...hourly));

  // 棒グラフパラメータ (1時間あたり 50px 幅, 全幅 1200px)
  const baseY = 540; // 下部の時間ラベルをギリギリまで大きく見せるためにベースラインを微調整
  const maxBarH = 370; // 太陽や月の位置 (y ≈ 160) まで届くダイナミックな高さ
  const barW = 32;
  const barOffset = (50 - barW) / 2; // = 9px

  // 24本の背景ストライプ
  let bandsSvg = '';
  SKY_COLORS.forEach((color, h) => {
    bandsSvg += `<rect x="${h * 50}" y="0" width="50" height="630" fill="${color}" />`;
  });

  // 24本の棒グラフバー
  let barsSvg = '';
  hourly.forEach((count, h) => {
    if (count === 0) return;
    const barH = Math.max(Math.round((count / maxCount) * maxBarH), 6);
    const x = h * 50 + barOffset;
    const y = baseY - barH;
    const isPeak = (h === peakHour && count > 0);
    const fill = isPeak ? 'url(#peakGrad)' : 'url(#barGrad)';

    barsSvg += `
      <g>
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="${fill}">
          <title>${h}時: ${count}件</title>
        </rect>
      </g>
    `;
  });

  // 横軸ラベル (2行で大きく表示: 数字 + am/pm)
  const hourLabels = [
    { h: 0,  num: '0',  period: 'am' },
    { h: 3,  num: '3',  period: 'am' },
    { h: 6,  num: '6',  period: 'am' },
    { h: 9,  num: '9',  period: 'am' },
    { h: 12, num: '12', period: 'pm' },
    { h: 15, num: '3',  period: 'pm' },
    { h: 18, num: '6',  period: 'pm' },
    { h: 21, num: '9',  period: 'pm' }
  ];

  let labelsSvg = '';
  hourLabels.forEach(({ h, num, period }) => {
    const x = h * 50 + 25;
    labelsSvg += `
      <g text-anchor="middle">
        <!-- 数字 (下部エリアの限界まで大きく) -->
        <text x="${x}" y="590" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" font-weight="700" fill="#ffffff" letter-spacing="-1">${num}</text>
        <!-- am / pm -->
        <text x="${x}" y="612" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.75)" letter-spacing="1">${period}</text>
      </g>
    `;
  });

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="100%" style="max-width: 800px; display: block; height: auto;">
  <defs>
    <clipPath id="canvasClip">
      <rect width="1200" height="630" />
    </clipPath>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.3" />
    </filter>
    <filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#1e4b7a" flood-opacity="0.18" />
    </filter>
    <linearGradient id="sunBody" x1="15%" y1="15%" x2="85%" y2="85%">
      <stop offset="0%" stop-color="#fff36b" />
      <stop offset="55%" stop-color="#ffe01b" />
      <stop offset="100%" stop-color="#edc300" />
    </linearGradient>
    <linearGradient id="moonBody" x1="15%" y1="15%" x2="85%" y2="85%">
      <stop offset="0%" stop-color="#f4f7fb" />
      <stop offset="60%" stop-color="#dfe5ef" />
      <stop offset="100%" stop-color="#c2cbd9" />
    </linearGradient>
    <!-- 通常バーのグラデーション（爽やかなパステルグリーン） -->
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#93f0b5" />
      <stop offset="100%" stop-color="#56cca4" />
    </linearGradient>

    <!-- ピークバーのグラデーション（明るく輝くライムパステルグリーン） -->
    <linearGradient id="peakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="60%" stop-color="#86efac" />
      <stop offset="100%" stop-color="#4ade80" />
    </linearGradient>
  </defs>

  <g clip-path="url(#canvasClip)">
    <!-- 24分割の空背景 -->
    <g id="skyBands24">
      ${bandsSvg}
    </g>

    <!-- 月 (深夜) -->
    <g transform="translate(150, 145)" filter="url(#softShadow)">
      <circle cx="0" cy="0" r="68" fill="#ffffff" />
      <circle cx="2" cy="2" r="66" fill="url(#moonBody)" />
      <circle cx="-16" cy="15" r="20" fill="#9aa5b8" />
      <circle cx="-14" cy="17" r="18.5" fill="#b0bacb" />
      <circle cx="7" cy="-24" r="12" fill="#9aa5b8" />
      <circle cx="8" cy="-23" r="10.8" fill="#b0bacb" />
      <circle cx="27" cy="19" r="14" fill="#9aa5b8" />
      <circle cx="28" cy="20" r="12.5" fill="#b0bacb" />
    </g>

    <!-- 太陽 ＋ 2層雲 (昼) -->
    <g transform="translate(600, 140)" filter="url(#softShadow)">
      <circle cx="0" cy="0" r="72" fill="#fffb9e" />
      <circle cx="2" cy="2" r="70" fill="url(#sunBody)" />
    </g>
    <g transform="translate(640, 155)">
      <g fill="#b8dffb" opacity="0.75">
        <circle cx="22" cy="42" r="24" />
        <circle cx="52" cy="28" r="30" />
        <circle cx="88" cy="22" r="34" />
        <circle cx="122" cy="34" r="26" />
        <rect x="22" y="34" width="100" height="26" rx="13" />
      </g>
      <g fill="#f8fcff" filter="url(#cloudShadow)">
        <circle cx="12" cy="50" r="20" />
        <circle cx="40" cy="38" r="26" />
        <circle cx="74" cy="32" r="30" />
        <circle cx="108" cy="40" r="24" />
        <circle cx="132" cy="50" r="18" />
        <rect x="12" y="40" width="120" height="28" rx="14" />
      </g>
    </g>

    <!-- 星々 (夜) -->
    <g fill="#ffffff">
      <path d="M 1055,95 Q 1055,117 1077,117 Q 1055,117 1055,139 Q 1055,117 1033,117 Q 1055,117 1055,95 Z" />
      <path d="M 985,160 Q 985,178 1003,178 Q 985,178 985,196 Q 985,178 967,178 Q 985,178 985,160 Z" />
      <path d="M 1125,185 Q 1125,199 1139,199 Q 1125,199 1125,213 Q 1125,199 1111,199 Q 1125,199 1125,185 Z" />
      <circle cx="1005" cy="105" r="4.5" opacity="0.95" />
      <circle cx="1135" cy="125" r="5" opacity="0.9" />
      <circle cx="1065" cy="180" r="3.5" opacity="0.85" />
      <circle cx="1095" cy="245" r="4" opacity="0.85" />
      <path d="M 235,85 Q 235,97 247,97 Q 235,97 235,109 Q 235,97 223,97 Q 235,97 235,85 Z" opacity="0.9" />
      <circle cx="55" cy="95" r="4" opacity="0.85" />
    </g>

    <!-- 棒グラフ用ベースライン -->
    <line x1="20" y1="${baseY}" x2="1180" y2="${baseY}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />

    <!-- 棒グラフバー -->
    <g id="bars">
      ${barsSvg}
    </g>

    <!-- 横軸ラベル -->
    <g id="labels">
      ${labelsSvg}
    </g>
  </g>
</svg>
  `.trim();
}

// --- 4. UI表示・URL生成 ---
/**
 * 共有URLを生成する（hパラメータはハイフン区切り）
 * @param {string} username ユーザー名
 * @param {number[]} hourly 0〜23時の件数配列
 * @returns {string} 共有URL
 */
function generateShareUrl(username, hourly) {
  const hParam = hourly.join('-');
  const shareUrl = new URL('/share', window.location.origin);
  shareUrl.searchParams.set('u', username);
  shareUrl.searchParams.set('h', hParam);
  return shareUrl.toString();
}

/**
 * 分析結果を画面に表示する
 * @param {object} result 分析結果オブジェクト
 */
function renderResult(result) {
  resultPre.textContent = JSON.stringify(result, null, 2);
  if (result.hourly && graphContainer) {
    graphContainer.innerHTML = generateGraphSvg(result.hourly);
  }
}

/**
 * エラーメッセージを画面に表示する
 * @param {string} message エラー内容
 */
function renderError(message) {
  resultPre.textContent = `エラー: ${message}`;
}

// --- 4. URLパラメータからの復元 ---
/**
 * URLクエリパラメータ (?u=...&h=...) があれば分析結果を復元して表示する
 */
function restoreFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const u = params.get('u');
  const h = params.get('h');

  if (!u || !h) return;

  const hourly = h.split('-').map(Number);
  // 24時間分の有効な数値か検証
  if (hourly.length !== 24 || hourly.some(isNaN)) return;

  usernameInput.value = u;
  const total = hourly.reduce((a, b) => a + b, 0);
  const shareUrl = generateShareUrl(u, hourly);

  renderResult({
    username: u,
    total: total,
    hourly: hourly,
    shareUrl: shareUrl
  });
}

// ページ読み込み時に復元を試行
window.addEventListener('DOMContentLoaded', restoreFromUrlParams);

// --- 5. イベント処理 ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim().replace(/^@/, '');
  if (!username) return;

  analyzeBtn.disabled = true;
  resultPre.textContent = '取得中...';

  try {
    // 1. 投稿データ取得
    const postDates = await fetchUserPosts(username);

    // 2. 24時間集計
    const hourly = aggregateHourlyJST(postDates);

    // 3. 共有URL生成
    const shareUrl = generateShareUrl(username, hourly);

    // 4. 結果表示
    renderResult({
      username: username,
      total: postDates.length,
      hourly: hourly,
      shareUrl: shareUrl
    });
  } catch (err) {
    renderError(err.message);
  } finally {
    analyzeBtn.disabled = false;
  }
});
