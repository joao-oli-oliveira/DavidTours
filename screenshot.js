const puppeteer = require('puppeteer');
const path = require('path');

// Env overrides: VIEWPORT_WIDTH (1440), VIEWPORT_HEIGHT (900), OUT (screenshot-full.png), SHOW_BANNER=1 (keep the cookie banner, as a first-time visitor sees it)
(async () => {
  const width = Number(process.env.VIEWPORT_WIDTH) || 1440;
  const height = Number(process.env.VIEWPORT_HEIGHT) || 900;
  const out = process.env.OUT || 'screenshot-full.png';
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  // Pretend the visitor already answered the cookie banner so it does not cover the page.
  if (!process.env.SHOW_BANNER) await page.evaluateOnNewDocument(() => { try { localStorage.setItem('cookie_consent', 'denied'); } catch (e) {} });
  const filePath = 'file://' + path.resolve(__dirname, 'index.html');
  await page.goto(filePath, { waitUntil: 'networkidle0' });
  // Scroll through the page so lazy-loaded images actually load, then wait for them.
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
    const total = document.documentElement.scrollHeight;
    for (let y = 0; y < total; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
    await Promise.all(Array.from(document.images).map(img =>
      (img.complete && img.naturalWidth > 0) ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; setTimeout(res, 3000); })
    ));
  });
  // backdrop-filter on sticky/fixed bars makes Chrome repeat page content in tall captures; drop it for the shot.
  await page.addStyleTag({ content: '.backdrop-blur{-webkit-backdrop-filter:none!important;backdrop-filter:none!important} .reveal{opacity:1!important;transform:none!important;transition:none!important}' });
  // Settle at the top before capturing.
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`done ${out} viewport=${width}x${height} scrollWidth=${scrollWidth}`);
})();
