const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const analyzeBtn = document.getElementById('analyzeBtn');
const exportBtn = document.getElementById('exportBtn');
const maxPagesEl = document.getElementById('maxPages');
const timeoutMsEl = document.getElementById('timeoutMs');
const excludeNewslettersEl = document.getElementById('excludeNewsletters');
const crawlMethodEl = document.getElementById('crawlMethod');
const sitemapUrlEl = document.getElementById('sitemapUrl');

function logStatus(text) {
  const line = document.createElement('div');
  line.textContent = text;
  statusEl.appendChild(line);
  statusEl.scrollTop = statusEl.scrollHeight;
}

function renderSummary(summary) {
  resultsEl.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'metric';
  header.innerHTML = `<h3>Domain</h3><div class="mono">${summary.domain}</div>`;
  resultsEl.appendChild(header);

  const pages = document.createElement('div');
  pages.className = 'metric';
  pages.innerHTML = `<h3>Crawled Pages (${summary.pages.length})</h3>` +
    summary.pages.map(p => `<div class="mono">${p.url} (${p.wordCount} words)</div>`).join('');
  resultsEl.appendChild(pages);

  const issues = document.createElement('div');
  issues.className = 'metric';
  issues.innerHTML = `<h3>SEO Issues (${summary.issues.length})</h3>` +
    (summary.issues.length ? summary.issues.map(i => `<div>• ${i}</div>`).join('') : '<div>No critical issues found.</div>');
  resultsEl.appendChild(issues);

  const keywords = document.createElement('div');
  keywords.className = 'metric';
  const topKw = summary.keywords.slice(0, 25).map(k => `${k.term} (${k.count})`).join(', ');
  keywords.innerHTML = `<h3>Top Keywords</h3><div class="mono">${topKw}</div>`;
  resultsEl.appendChild(keywords);

  const recs = document.createElement('div');
  recs.className = 'metric';
  recs.innerHTML = `<h3>Recommendations</h3>` + summary.recommendations.map(r => `<div>• ${r}</div>`).join('');
  resultsEl.appendChild(recs);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'seo-progress') {
    logStatus(msg.message);
  } else if (msg.type === 'seo-complete') {
    analyzeBtn.disabled = false;
    logStatus('Analysis complete.');
    renderSummary(msg.payload);
  } else if (msg.type === 'seo-error') {
    analyzeBtn.disabled = false;
    logStatus(`Error: ${msg.message}`);
  }
});

analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.disabled = true;
  statusEl.textContent = '';
  resultsEl.textContent = '';

  const params = {
    maxPages: Number(maxPagesEl.value || 15),
    timeoutMs: Number(timeoutMsEl.value || 8000),
    excludeNewsletters: Boolean(excludeNewslettersEl.checked),
    crawlMethod: crawlMethodEl.value || 'sitemap',
    sitemapUrl: (sitemapUrlEl.value || '').trim()
  };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url) {
    analyzeBtn.disabled = false;
    logStatus('No active tab.');
    return;
  }

  chrome.runtime.sendMessage({ type: 'seo-start', tabId: tab.id, url: tab.url, params });
  logStatus('Started analysis…');
});

exportBtn.addEventListener('click', async () => {
  const { lastSeoSummary } = await chrome.storage.local.get(['lastSeoSummary']);
  if (!lastSeoSummary) {
    logStatus('No analysis to export yet. Run an analysis first.');
    return;
  }
  const url = chrome.runtime.getURL('report.html');
  const tab = await chrome.tabs.create({ url });
  // pass data via storage; report page will read from storage
});


