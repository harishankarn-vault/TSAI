// Expose a function the background can call to extract data from the current page
window.__SEO_EXTRACT__ = function () {
  const title = document.title || '';
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).filter(Boolean);
  const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).filter(Boolean);
  const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
  const images = Array.from(document.querySelectorAll('img'));
  const imagesMissingAlt = images.filter(img => !(img.getAttribute('alt') || '').trim()).length;
  const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
  const text = document.body ? document.body.innerText : '';
  const wordCount = text.split(/\s+/).filter(Boolean).length;

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
};


