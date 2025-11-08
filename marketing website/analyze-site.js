const { chromium, webkit, firefox, request } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs');

const SITE_URL = 'https://rexfordcommercialcapital.com/';
const MAX_PAGES = 10;

async function analyzeSite() {
  const analysis = {
    url: SITE_URL,
    timestamp: new Date().toISOString(),
    pages: {},
    navigation: [],
    forms: [],
    features: [],
    scripts: [],
    styles: [],
    meta: {}
  };

  const browser = await launchBrowser();

  if (browser) {
    console.log('Running full-browser Playwright analysis...');
    try {
      const page = await browser.newPage();
      await runAnalysis(analysis, async url => {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        return await page.content();
      });
    } finally {
      await browser.close().catch(() => {});
    }
  } else {
    console.warn('Browser engines unavailable, falling back to Playwright HTTP analysis.');
    const requestContext = await request.newContext();
    try {
      await runAnalysis(analysis, async url => {
        const response = await requestContext.get(url, { timeout: 45000 });
        if (!response.ok()) {
          throw new Error(`Request failed (${response.status()}): ${url}`);
        }
        return await response.text();
      });
    } finally {
      await requestContext.dispose();
    }
  }

  fs.writeFileSync('site-analysis.json', JSON.stringify(analysis, null, 2));
  console.log('\nAnalysis saved to site-analysis.json');

  const summary = createSummary(analysis);
  fs.writeFileSync('site-analysis-summary.md', summary);
  console.log('Summary saved to site-analysis-summary.md');

  return analysis;
}

async function launchBrowser() {
  const chromiumArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  try {
    return await chromium.launch({ headless: true, args: chromiumArgs });
  } catch (error) {
    console.warn('Chromium launch failed, trying Firefox:', error.message);
    try {
      return await firefox.launch({ headless: true });
    } catch (firefoxError) {
      console.warn('Firefox launch failed, trying WebKit:', firefoxError.message);
      try {
        return await webkit.launch({ headless: true });
      } catch (webkitError) {
        console.warn('WebKit launch failed:', webkitError.message);
        return null;
      }
    }
  }
}

async function runAnalysis(analysis, getHtml) {
  console.log('Analyzing homepage...');
  const homepageHtml = await getHtml(SITE_URL);
  const homepageData = parseHtml(homepageHtml, SITE_URL, 'Homepage');

  analysis.meta = homepageData.meta;
  analysis.navigation = homepageData.navigation;
  analysis.scripts = homepageData.assets.scripts;
  analysis.styles = homepageData.assets.styles;
  analysis.pages[SITE_URL] = homepageData.page;

  const internalLinks = filterInternalLinks(homepageData.links, SITE_URL).slice(0, MAX_PAGES);

  for (const url of internalLinks) {
    try {
      console.log(`Analyzing ${url}...`);
      const html = await getHtml(url);
      const parsed = parseHtml(html, url, derivePageName(url));
      analysis.pages[url] = parsed.page;
    } catch (error) {
      console.warn(`Failed to analyze ${url}: ${error.message}`);
    }
  }

  analysis.forms = Object.values(analysis.pages).flatMap(page => page.forms || []);
  analysis.features = buildFeatures(analysis, homepageHtml);
}

function parseHtml(html, url, name) {
  const $ = cheerio.load(html);

  const meta = {
    title: ($('title').first().text() || name).trim(),
    description: $('meta[name="description"]').attr('content') || null,
    viewport: $('meta[name="viewport"]').attr('content') || null
  };

  const headings = { h1: [], h2: [], h3: [], h4: [] };
  ['h1', 'h2', 'h3', 'h4'].forEach(tag => {
    headings[tag] = $(tag).map((_, el) => $(el).text().trim()).get();
  });

  const forms = $('form')
    .map((idx, form) => {
      const fields = $(form)
        .find('input, textarea, select')
        .map((_, field) => ({
          type: $(field).attr('type') || field.tagName.toLowerCase(),
          name: $(field).attr('name') || $(field).attr('id') || '',
          placeholder: $(field).attr('placeholder') || '',
          required: $(field).attr('required') !== undefined
        }))
        .get();

      return {
        id: $(form).attr('id') || `form-${idx}`,
        action: resolveUrl(url, $(form).attr('action')) || '',
        method: ($(form).attr('method') || 'GET').toUpperCase(),
        fields
      };
    })
    .get();

  const sections = $(['section', '.section', 'main', 'article', '.content'].join(','))
    .slice(0, 5)
    .map((_, section) => {
      const text = $(section).text().trim().replace(/\s+/g, ' ');
      return {
        classes: section.attribs?.class || '',
        preview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
      };
    })
    .get();

  const images = $('img')
    .slice(0, 10)
    .map((_, img) => ({
      src: resolveUrl(url, $(img).attr('src')),
      alt: $(img).attr('alt') || '',
      width: Number($(img).attr('width')) || null,
      height: Number($(img).attr('height')) || null
    }))
    .get();

  const navigation = dedupeObjects(
    $('nav a, header a, .menu a')
      .map((_, link) => ({
        text: $(link).text().trim(),
        href: resolveUrl(url, $(link).attr('href'))
      }))
      .get()
      .filter(link => link.href && link.text)
  );

  const scripts = uniqueList(
    $('script[src]')
      .map((_, script) => resolveUrl(url, $(script).attr('src')))
      .get()
      .filter(Boolean)
  );

  const styles = uniqueList(
    $('link[rel="stylesheet"]')
      .map((_, link) => resolveUrl(url, $(link).attr('href')))
      .get()
      .filter(Boolean)
  );

  const links = uniqueList(
    $('a[href]')
      .map((_, link) => resolveUrl(url, $(link).attr('href')))
      .get()
      .filter(Boolean)
  );

  return {
    meta,
    navigation,
    assets: { scripts, styles },
    links,
    page: {
      name,
      url,
      title: meta.title,
      headings,
      forms,
      images,
      sections
    }
  };
}

function filterInternalLinks(links, baseUrl) {
  const baseOrigin = new URL(baseUrl).origin;
  const normalizedHome = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const seen = new Set();
  const result = [];

  for (const link of links) {
    if (!link) continue;
    try {
      const target = new URL(link, baseOrigin);
      if (target.origin !== baseOrigin) continue;
      const normalized = target.href.replace(/#.*$/, '');
      if (normalized === normalizedHome) continue;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    } catch {
      continue;
    }
  }

  return result;
}

function derivePageName(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    const segment = pathname.split('/').filter(Boolean).pop();
    if (!segment) {
      return 'Page';
    }
    return segment
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return 'Page';
  }
}

function buildFeatures(analysis, homepageHtml = '') {
  const scripts = analysis.scripts || [];
  const styles = analysis.styles || [];
  const isWordPress =
    scripts.some(src => src.includes('wp-content') || src.includes('wp-includes')) ||
    styles.some(href => href.includes('wp-content') || href.includes('wp-includes')) ||
    homepageHtml.includes('wp-content');

  return [
    { name: 'Platform', value: isWordPress ? 'WordPress' : 'Unknown' },
    { name: 'Script Count', value: scripts.length },
    { name: 'Stylesheet Count', value: styles.length }
  ];
}

function resolveUrl(base, relative) {
  if (!relative) return null;
  if (relative.startsWith('mailto:') || relative.startsWith('tel:')) {
    return relative;
  }
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function uniqueList(items) {
  return Array.from(new Set(items));
}

function dedupeObjects(items) {
  const seen = new Set();
  const result = [];
  items.forEach(item => {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });
  return result;
}

function createSummary(analysis) {
  let md = `# Website Analysis: Rexford Commercial Capital\n\n`;
  md += `**Analysis Date:** ${new Date(analysis.timestamp).toLocaleDateString()}\n\n`;
  md += `**URL:** ${analysis.url}\n\n`;

  md += `## Platform & Technical Details\n\n`;
  md += `- **Platform:** ${analysis.features.find(f => f.name === 'Platform')?.value || 'Unknown'}\n`;
  md += `- **JavaScript Files:** ${analysis.scripts.length}\n`;
  md += `- **Stylesheets:** ${analysis.styles.length}\n`;
  md += `- **Title:** ${analysis.meta.title || 'N/A'}\n`;
  md += `- **Meta Description:** ${analysis.meta.description || 'Not set'}\n\n`;

  if (analysis.navigation.length > 0) {
    md += `## Navigation Structure\n\n`;
    analysis.navigation.forEach(link => {
      md += `- [${link.text}](${link.href})\n`;
    });
    md += `\n`;
  }

  md += `## Pages Analyzed\n\n`;
  Object.entries(analysis.pages).forEach(([url, page]) => {
    md += `### ${page.title}\n`;
    md += `**URL:** ${url}\n\n`;

    if (page.headings.h1?.length > 0) {
      md += `**Main Heading:** ${page.headings.h1[0]}\n\n`;
    }

    if (page.headings.h2?.length > 0) {
      md += `**Subheadings:**\n`;
      page.headings.h2.forEach(h => (md += `- ${h}\n`));
      md += `\n`;
    }

    if (page.forms.length > 0) {
      md += `**Forms on this page:** ${page.forms.length}\n`;
      page.forms.forEach((form, idx) => {
        md += `\nForm ${idx + 1}: ${form.id}\n`;
        md += `- Action: ${form.action || 'N/A'}\n`;
        md += `- Method: ${form.method}\n`;
        md += `- Fields: ${form.fields.length}\n`;
        form.fields.forEach(field => {
          md += `  - ${field.type}: ${field.name || field.placeholder}${field.required ? ' (required)' : ''}\n`;
        });
      });
      md += `\n`;
    }
  });

  md += `\n## Forms Summary\n\n`;
  md += `Total forms found: ${analysis.forms.length}\n\n`;

  md += `\n## Key Findings\n\n`;
  md += `- **SEO:** ${analysis.meta.description ? 'Meta description present' : '⚠️ Missing meta description'}\n`;
  md += `- **Responsive Design:** ${analysis.meta.viewport ? 'Viewport meta tag present' : '⚠️ Missing viewport meta tag'}\n`;
  md += `- **JavaScript Load:** ${analysis.scripts.length} external scripts (${analysis.scripts.length > 20 ? 'Heavy' : analysis.scripts.length > 10 ? 'Moderate' : 'Light'})\n`;

  return md;
}

analyzeSite().catch(error => {
  console.error('Analysis failed:', error);
  process.exitCode = 1;
});

