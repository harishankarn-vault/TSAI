// Utility: simple event dispatch to popup
function reportProgress(message) {
  chrome.runtime.sendMessage({ type: 'seo-progress', message }).catch(() => {});
}

function reportError(message) {
  chrome.runtime.sendMessage({ type: 'seo-error', message }).catch(() => {});
}

function complete(payload) {
    chrome.storage.local.set({ lastSeoSummary: payload, lastSeoSummaryAt: Date.now() }).catch(() => {});
  chrome.runtime.sendMessage({ type: 'seo-complete', payload }).catch(() => {});
}

function normalizeUrl(urlString) {
  try { return new URL(urlString); } catch { return null; }
}

function isSameOrigin(linkUrl, origin) {
  const u = normalizeUrl(linkUrl);
  return !!u && u.origin === origin;
}

function looksLikeNewsletterOrArchive(url) {
  const lc = url.toLowerCase();
  // Matches common newsletter/archive paths and dated blog URLs like /2024/08/19/
  const pattern = /(newsletter|archive|feed|rss|\/[0-9]{4}\/([0-9]{2})\/([0-9]{2})\/)/;
  return pattern.test(lc) || lc.includes('utm_');
}

async function executeContentExtraction(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__SEO_EXTRACT__ && window.__SEO_EXTRACT__()
  });
  return result;
}

async function fetchPageViaNetwork(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit', mode: 'cors' });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(t);
  }
}

function extractLinksFromHtml(html, baseUrl) {
  const urls = new Set();
  const anchorRegex = /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      const abs = new URL(href, baseUrl).href;
      urls.add(abs);
    } catch {}
  }
  return Array.from(urls);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function topN(map, n) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

function buildNgrams(tokens, n) {
  const grams = new Map();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
}

function analyzeHtml(html, baseUrl) {
  // Remove scripts and styles for text extraction
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch ? titleMatch[1] : '').trim();

  function findMeta(name) {
    const r1 = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    const r2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["'][^>]*>`, 'i');
    const m = cleaned.match(r1) || cleaned.match(r2);
    return m ? m[1].trim() : '';
  }
  const metaDesc = findMeta('description');
  const robots = findMeta('robots');

  function findLinkRel(relName) {
    const r1 = new RegExp(`<link[^>]*rel=["']${relName}["'][^>]*href=["']([^"']*)["'][^>]*>`, 'i');
    const r2 = new RegExp(`<link[^>]*href=["']([^"']*)["'][^>]*rel=["']${relName}["'][^>]*>`, 'i');
    const m = cleaned.match(r1) || cleaned.match(r2);
    return m ? m[1].trim() : '';
  }
  const canonical = findLinkRel('canonical');

  function extractHeadings(tag) {
    const re = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'gi');
    const list = [];
    let m;
    while ((m = re.exec(cleaned)) !== null) {
      const inner = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (inner) list.push(inner);
    }
    return list;
  }
  const h1s = extractHeadings('h1');
  const h2s = extractHeadings('h2');

  // Image alt analysis
  const imgs = cleaned.match(/<img\b[^>]*>/gi) || [];
  let imagesMissingAlt = 0;
  for (const tag of imgs) {
    if (!/\balt\s*=\s*(["'][^"']*["']|[^\s>]+)/i.test(tag)) imagesMissingAlt++;
  }

  // Links
  const links = extractLinksFromHtml(cleaned, baseUrl);

  // Text content approximation
  const text = cleaned.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = tokenize(text).length;

  const issues = [];
  if (!title) issues.push('Missing <title>.');
  if (title.length > 60) issues.push('Title likely too long (>60 chars).');
  if (!metaDesc) issues.push('Missing meta description.');
  if (metaDesc.length && (metaDesc.length < 50 || metaDesc.length > 160)) issues.push('Meta description length suboptimal (50-160 recommended).');
  if (h1s.length === 0) issues.push('No H1 heading.');
  if (h1s.length > 1) issues.push('Multiple H1 headings detected.');
  if (!canonical) issues.push('Missing canonical link.');
  if (/noindex|nofollow/.test(robots)) issues.push(`Robots meta contains: ${robots}`);
  if (imagesMissingAlt > 0) issues.push(`${imagesMissingAlt} image(s) missing alt text.`);
  if (links.length > 300) issues.push('Page has very high number of links (>300).');

  return { title, metaDesc, h1s, h2s, canonical, robots, imagesMissingAlt, links, wordCount, issues, text };
}

function mergeKeywordStats(perPageStats) {
  const uni = new Map();
  const bi = new Map();
  const tri = new Map();
  for (const s of perPageStats) {
    for (const [k, v] of s.unigrams.entries()) uni.set(k, (uni.get(k) || 0) + v);
    for (const [k, v] of s.bigrams.entries()) bi.set(k, (bi.get(k) || 0) + v);
    for (const [k, v] of s.trigrams.entries()) tri.set(k, (tri.get(k) || 0) + v);
  }
  return { uni, bi, tri };
}

function dedupeAndPrioritizeLinks(links, origin, excludeNewsletters) {
  const seen = new Set();
  const filtered = [];
  for (const url of links) {
    if (!isSameOrigin(url, origin)) continue;
    if (excludeNewsletters && looksLikeNewsletterOrArchive(url)) continue;
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|mp4|mp3|mov)(\?|$)/i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    filtered.push(url);
  }
  return filtered;
}

async function analyzePage(url, start, params, activeTabId) {
  const net = await fetchPageViaNetwork(url, params.timeoutMs);
  let info;
  if (!net.ok) {
    reportProgress(`Failed (${net.status}) ${url}`);
    if (activeTabId && url === start.href) {
      try {
        reportProgress('Falling back to on-page extraction for active tab…');
        const extracted = await executeContentExtraction(activeTabId);
        info = {
          title: extracted.title,
          metaDesc: extracted.metaDesc,
          h1s: extracted.h1s,
          h2s: extracted.h2s,
          canonical: extracted.canonical,
          robots: extracted.robots,
          imagesMissingAlt: extracted.imagesMissingAlt,
          links: extracted.links,
          wordCount: extracted.wordCount,
          issues: extracted.issues,
          text: extracted.text
        };
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
  } else {
    info = analyzeHtml(net.text, url);
  }
  return info;
}

function updateStatsFromInfo(info, pages, perPageKeywordStats, url) {
  const tokens = tokenize(info.text);
  const stats = {
    unigrams: buildNgrams(tokens, 1),
    bigrams: buildNgrams(tokens, 2),
    trigrams: buildNgrams(tokens, 3)
  };
  perPageKeywordStats.push(stats);
  pages.push({ url, title: info.title, wordCount: info.wordCount, issues: info.issues });
}

async function crawlViaLinks(startUrl, params, activeTabId) {
  const start = normalizeUrl(startUrl);
  if (!start) throw new Error('Invalid URL');
  const origin = start.origin;
  const queue = [start.href];
  const visited = new Set();
  const pages = [];
  const perPageKeywordStats = [];

  while (queue.length && pages.length < params.maxPages) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    reportProgress(`Fetching ${url}`);
    const info = await analyzePage(url, start, params, activeTabId);
    if (!info) continue;
    updateStatsFromInfo(info, pages, perPageKeywordStats, url);

    const newLinks = dedupeAndPrioritizeLinks(info.links, origin, params.excludeNewsletters);
    for (const l of newLinks) {
      if (!visited.has(l)) queue.push(l);
    }
  }
  return finalizeSummary(origin, pages, perPageKeywordStats);
}

function finalizeSummary(origin, pages, perPageKeywordStats) {
  const merged = mergeKeywordStats(perPageKeywordStats);
  const topKeywords = [
    ...topN(merged.uni, 40),
    ...topN(merged.bi, 20),
    ...topN(merged.tri, 10)
  ];

  const allIssues = pages.flatMap(p => p.issues.map(i => `${i} [${p.url}]`));

  const recommendations = [];
  if (!pages.length) recommendations.push('No pages analyzed. Ensure the site permits fetching and try again.');
  const avgWords = pages.length ? Math.round(pages.reduce((a, b) => a + b.wordCount, 0) / pages.length) : 0;
  if (avgWords && avgWords < 300) recommendations.push('Increase on-page copy. Aim for 500–1000 words on key pages.');
  const imgAltIssues = allIssues.filter(i => i.includes('image(s) missing alt')).length;
  if (imgAltIssues) recommendations.push('Add descriptive alt text to images.');
  if (topKeywords.length) recommendations.push('Use top keywords naturally in titles, H1/H2, and first 100 words.');
  recommendations.push('Ensure fast TTFB, reduce blocking JS/CSS, and compress images for performance.');

  return {
    domain: origin,
    pages,
    keywords: topKeywords,
    issues: allIssues,
    recommendations
  };
}

async function fetchRobotsSitemaps(origin, timeoutMs) {
  try {
    const robotsUrl = `${origin.replace(/\/$/, '')}/robots.txt`;
    const res = await fetchPageViaNetwork(robotsUrl, timeoutMs);
    if (!res.ok) return [];
    const matches = Array.from(res.text.matchAll(/(^|\s)Sitemap:\s*(\S+)/gi));
    return matches.map(m => m[2]);
  } catch { return []; }
}

function parseSitemapLocs(xmlText) {
  const locs = Array.from(xmlText.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)).map(m => m[1].trim());
  return locs;
}

async function fetchSitemapUrlsRecursive(url, timeoutMs, limit, collected = new Set()) {
  if (collected.size >= limit) return collected;
  const resp = await fetchPageViaNetwork(url, timeoutMs);
  if (!resp.ok) return collected;
  const xml = resp.text;
  const locs = parseSitemapLocs(xml);
  const isIndex = /<sitemapindex/i.test(xml);
  for (const loc of locs) {
    if (collected.size >= limit) break;
    if (isIndex) {
      // Only follow a limited number of child sitemaps
      await fetchSitemapUrlsRecursive(loc, timeoutMs, limit, collected);
    } else {
      collected.add(loc);
    }
  }
  return collected;
}

async function discoverSitemapUrls(startUrl, params) {
  const start = normalizeUrl(startUrl);
  if (!start) return [];
  const origin = start.origin;
  const candidates = [];
  if (params.sitemapUrl) candidates.push(params.sitemapUrl);
  const robots = await fetchRobotsSitemaps(origin, params.timeoutMs);
  candidates.push(...robots);
  candidates.push(`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`);
  // Deduplicate
  const seen = new Set();
  const unique = candidates.filter(u => { if (seen.has(u)) return false; seen.add(u); return true; });

  const collected = new Set();
  for (const c of unique) {
    if (collected.size >= params.maxPages) break;
    try {
      await fetchSitemapUrlsRecursive(c, params.timeoutMs, params.maxPages, collected);
    } catch {}
  }
  // Filter to same-origin
  return Array.from(collected).filter(u => isSameOrigin(u, origin)).slice(0, params.maxPages);
}

async function crawlViaSitemap(startUrl, params, activeTabId) {
  const start = normalizeUrl(startUrl);
  if (!start) throw new Error('Invalid URL');
  const origin = start.origin;
  reportProgress('Discovering sitemap URLs…');
  const urls = await discoverSitemapUrls(startUrl, params);
  if (!urls.length) throw new Error('No sitemap URLs discovered. Provide a custom sitemap URL or switch to Internal links.');
  const pages = [];
  const perPageKeywordStats = [];
  for (const url of urls.slice(0, params.maxPages)) {
    reportProgress(`Fetching ${url}`);
    const info = await analyzePage(url, start, params, activeTabId);
    if (!info) continue;
    updateStatsFromInfo(info, pages, perPageKeywordStats, url);
  }
  return finalizeSummary(origin, pages, perPageKeywordStats);
}

async function crawlSite(startUrl, params, activeTabId) {
  if (params.crawlMethod === 'links') {
    return crawlViaLinks(startUrl, params, activeTabId);
  }
  return crawlViaSitemap(startUrl, params, activeTabId);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'seo-start') {
    const { url, params, tabId } = msg;
    crawlSite(url, params, tabId)
      .then(summary => complete(summary))
      .catch(err => reportError(err?.message || String(err)));
  }
});


