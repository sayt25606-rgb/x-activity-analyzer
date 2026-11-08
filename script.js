const form = document.getElementById('analyzeForm');
const usernameInput = document.getElementById('username');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultPre = document.getElementById('result');

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

// --- 3. UI表示・URL生成 ---
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
