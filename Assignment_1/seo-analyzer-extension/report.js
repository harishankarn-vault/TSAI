function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

async function load() {
  const { lastSeoSummary, lastSeoSummaryAt } = await chrome.storage.local.get(['lastSeoSummary', 'lastSeoSummaryAt']);
  const data = lastSeoSummary || { domain: '', pages: [], keywords: [], issues: [], recommendations: [] };
  document.getElementById('domain').textContent = data.domain || 'Unknown domain';
  const d = lastSeoSummaryAt ? new Date(lastSeoSummaryAt) : new Date();
  document.getElementById('generated').textContent = d.toLocaleString();

  const summary = el('div', 'grid');
  const pagesCount = data.pages.length;
  const avgWords = pagesCount ? Math.round(data.pages.reduce((a, b) => a + b.wordCount, 0) / pagesCount) : 0;
  summary.append(
    el('div', '', `<strong>Pages crawled:</strong> ${pagesCount}`),
    el('div', '', `<strong>Avg. words per page:</strong> ${avgWords}`)
  );
  document.getElementById('summary').appendChild(summary);

  const pages = el('div', 'list');
  for (const p of data.pages) {
    pages.appendChild(el('div', '', `<span class="small">${p.wordCount} words</span> — <span class="code">${p.url}</span>`));
  }
  document.getElementById('pages').appendChild(pages);

  const kDiv = el('div', 'list');
  for (const k of data.keywords.slice(0, 50)) {
    kDiv.appendChild(el('div', '', `<span class="code">${k.term}</span> — ${k.count}`));
  }
  document.getElementById('keywords').appendChild(kDiv);

  const issues = el('div', 'list');
  if (data.issues.length === 0) issues.appendChild(el('div', '', 'No critical issues.'));
  for (const i of data.issues) issues.appendChild(el('div', '', i));
  document.getElementById('issues').appendChild(issues);

  const recs = el('div', 'list');
  for (const r of data.recommendations) recs.appendChild(el('div', '', `• ${r}`));
  document.getElementById('recs').appendChild(recs);

  document.getElementById('printBtn').addEventListener('click', () => window.print());
}

load();


