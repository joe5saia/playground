const { chromium } = require('playwright');
const fs = require('fs');

async function analyzeSite() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const siteUrl = 'https://rexfordcommercialcapital.com/';
  const analysis = {
    url: siteUrl,
    timestamp: new Date().toISOString(),
    pages: {},
    navigation: [],
    forms: [],
    features: [],
    scripts: [],
    styles: [],
    meta: {}
  };

  console.log('Analyzing homepage...');
  await page.goto(siteUrl, { waitUntil: 'networkidle' });

  // Extract meta information
  analysis.meta.title = await page.title();
  analysis.meta.description = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);
  analysis.meta.viewport = await page.$eval('meta[name="viewport"]', el => el.content).catch(() => null);

  // Extract navigation links
  const navLinks = await page.$$eval('nav a, header a, .menu a', links =>
    links.map(link => ({
      text: link.textContent.trim(),
      href: link.href
    }))
  );
  analysis.navigation = [...new Set(navLinks.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));

  // Extract all internal links
  const allLinks = await page.$$eval('a[href]', links =>
    links.map(link => link.href).filter(href => !href.startsWith('mailto:') && !href.startsWith('tel:'))
  );
  const internalLinks = [...new Set(allLinks.filter(link => link.includes('rexfordcommercialcapital.com')))];

  // Analyze homepage
  const homepageContent = await analyzePage(page, siteUrl, 'Homepage');
  analysis.pages[siteUrl] = homepageContent;

  // Analyze key pages (limit to avoid too much scraping)
  const pagesToAnalyze = internalLinks.slice(0, 10);
  for (const url of pagesToAnalyze) {
    try {
      console.log(`Analyzing ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const pageContent = await analyzePage(page, url, url.split('/').pop() || 'page');
      analysis.pages[url] = pageContent;
    } catch (error) {
      console.log(`Error analyzing ${url}: ${error.message}`);
    }
  }

  // Count scripts and styles
  await page.goto(siteUrl, { waitUntil: 'networkidle' });
  analysis.scripts = await page.$$eval('script[src]', scripts => scripts.map(s => s.src));
  analysis.styles = await page.$$eval('link[rel="stylesheet"]', styles => styles.map(s => s.href));

  // Detect WordPress
  const isWordPress = analysis.scripts.some(s => s.includes('wp-content') || s.includes('wp-includes'));
  analysis.features.push({
    name: 'Platform',
    value: isWordPress ? 'WordPress' : 'Unknown'
  });

  analysis.features.push({
    name: 'Script Count',
    value: analysis.scripts.length
  });

  analysis.features.push({
    name: 'Stylesheet Count',
    value: analysis.styles.length
  });

  // Extract forms from all pages
  const allForms = Object.values(analysis.pages).flatMap(p => p.forms || []);
  analysis.forms = allForms;

  // Save analysis
  fs.writeFileSync('site-analysis.json', JSON.stringify(analysis, null, 2));
  console.log('\nAnalysis saved to site-analysis.json');

  // Create readable summary
  const summary = createSummary(analysis);
  fs.writeFileSync('site-analysis-summary.md', summary);
  console.log('Summary saved to site-analysis-summary.md');

  await browser.close();
  return analysis;
}

async function analyzePage(page, url, name) {
  const content = {
    name,
    url,
    title: await page.title(),
    headings: {},
    forms: [],
    images: [],
    sections: []
  };

  // Extract headings
  const headings = await page.evaluate(() => {
    const result = { h1: [], h2: [], h3: [], h4: [] };
    ['h1', 'h2', 'h3', 'h4'].forEach(tag => {
      result[tag] = Array.from(document.querySelectorAll(tag)).map(h => h.textContent.trim());
    });
    return result;
  });
  content.headings = headings;

  // Extract forms
  const forms = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('form')).map((form, idx) => {
      const fields = Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
        type: field.type || field.tagName.toLowerCase(),
        name: field.name || field.id || '',
        placeholder: field.placeholder || '',
        required: field.required
      }));
      return {
        id: form.id || `form-${idx}`,
        action: form.action,
        method: form.method || 'GET',
        fields
      };
    });
  });
  content.forms = forms;

  // Extract main content sections
  const sections = await page.evaluate(() => {
    const sectionElements = document.querySelectorAll('section, .section, main, article, .content');
    return Array.from(sectionElements).slice(0, 5).map(section => {
      const classes = section.className;
      const text = section.textContent.trim().substring(0, 200);
      return { classes, preview: text + '...' };
    });
  });
  content.sections = sections;

  // Extract images
  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).slice(0, 10).map(img => ({
      src: img.src,
      alt: img.alt || '',
      width: img.width,
      height: img.height
    }));
  });
  content.images = images;

  return content;
}

function createSummary(analysis) {
  let md = `# Website Analysis: Rexford Commercial Capital\n\n`;
  md += `**Analysis Date:** ${new Date(analysis.timestamp).toLocaleDateString()}\n\n`;
  md += `**URL:** ${analysis.url}\n\n`;

  md += `## Platform & Technical Details\n\n`;
  md += `- **Platform:** ${analysis.features.find(f => f.name === 'Platform')?.value || 'Unknown'}\n`;
  md += `- **JavaScript Files:** ${analysis.scripts.length}\n`;
  md += `- **Stylesheets:** ${analysis.styles.length}\n`;
  md += `- **Title:** ${analysis.meta.title}\n`;
  md += `- **Meta Description:** ${analysis.meta.description || 'Not set'}\n\n`;

  md += `## Navigation Structure\n\n`;
  analysis.navigation.forEach(link => {
    md += `- [${link.text}](${link.href})\n`;
  });

  md += `\n## Pages Analyzed\n\n`;
  Object.entries(analysis.pages).forEach(([url, page]) => {
    md += `### ${page.title}\n`;
    md += `**URL:** ${url}\n\n`;

    if (page.headings.h1.length > 0) {
      md += `**Main Heading:** ${page.headings.h1[0]}\n\n`;
    }

    if (page.headings.h2.length > 0) {
      md += `**Subheadings:**\n`;
      page.headings.h2.forEach(h => md += `- ${h}\n`);
      md += `\n`;
    }

    if (page.forms.length > 0) {
      md += `**Forms on this page:** ${page.forms.length}\n`;
      page.forms.forEach((form, idx) => {
        md += `\nForm ${idx + 1}: ${form.id}\n`;
        md += `- Action: ${form.action}\n`;
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

analyzeSite().catch(console.error);
