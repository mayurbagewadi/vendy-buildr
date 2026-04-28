/**
 * Post-build prerender script — Option B (Puppeteer SSG)
 *
 * Flow:
 *   1. vite build  →  dist/ (CSR build)
 *   2. node scripts/prerender.mjs
 *       → starts vite preview (serves dist/)
 *       → launches headless Chrome (puppeteer)
 *       → visits http://localhost:4173/
 *       → waits for React to fully render
 *       → captures static HTML (includes Helmet meta tags + full content)
 *       → overwrites dist/index.html
 *
 * Result: dist/index.html is real static HTML — React hydrates on top.
 * SEO bots, Clarity, and social share previews all see full content.
 *
 * Non-fatal: if Chrome/puppeteer fails, CSR build in dist/ is used as fallback.
 */

import { preview } from 'vite'
import puppeteer from 'puppeteer'
import { writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT     = resolve(__dirname, '..')
const PORT     = 4173
const TARGET   = `http://localhost:${PORT}/`
const TIMEOUT  = 30_000

async function prerender() {
  console.log('\n🔨 [Prerender] Post-build SSG starting...')

  // Step 1 — start vite preview to serve the freshly built dist/
  const server = await preview({
    preview : { port: PORT, open: false, host: 'localhost' },
    logLevel: 'silent',
  })

  let browser
  try {
    // Step 2 — launch headless Chrome
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // critical for VPS / low-memory servers
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })

    // Speed up: skip images, fonts, media — we only need the DOM
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const type = req.resourceType()
      if (type === 'image' || type === 'media' || type === 'font') {
        req.abort()
      } else {
        req.continue()
      }
    })

    // Step 3 — visit landing page, wait for React + Helmet to fully render
    console.log(`   → Visiting ${TARGET}`)
    await page.goto(TARGET, { waitUntil: 'networkidle0', timeout: TIMEOUT })

    // Wait for React to mount something real inside #root
    await page.waitForSelector('#root > *', { timeout: 15_000 })

    // Step 4 — clean up DOM before capturing static HTML
    await page.evaluate(() => {
      // 4a — Reset animated text to initial GSAP "from" state (prevents hydration flash)
      document.querySelectorAll('.word-inner').forEach((el) => {
        el.style.opacity = '0'
        el.style.transform = 'translateY(110%) rotateX(-40deg)'
      })

      // 4b — Strip third-party scripts injected by React during render.
      // Without this, they get baked into static HTML as render-blocking scripts.
      // React will re-inject them asynchronously on hydration via useEffect/Helmet.
      const blocklist = [
        'googlesyndication.com',   // AdSense
        'googletagmanager.com',    // GA4 / GTM
        'google-analytics.com',    // Legacy GA
        'clarity.ms',              // Microsoft Clarity
        'cloudflareinsights.com',  // Cloudflare Analytics
      ]
      document.querySelectorAll('script').forEach((s) => {
        const src = s.src || s.textContent || ''
        if (blocklist.some((domain) => src.includes(domain))) {
          s.remove()
        }
      })
      // Also remove inline gtag/dataLayer scripts
      document.querySelectorAll('script').forEach((s) => {
        if (!s.src && s.textContent && (s.textContent.includes('dataLayer') || s.textContent.includes('gtag'))) {
          s.remove()
        }
      })
    })

    // Step 5 — capture fully rendered HTML (clean of third-party scripts)
    let html = await page.content()

    // Step 6 — inject performance hints into <head>

    // 6a — WOFF2 font preloads: browser starts downloading fonts immediately,
    //      before the CSS parser even finds the @font-face declarations.
    try {
      const assetsDir = resolve(ROOT, 'dist', 'assets')
      const woff2Files = readdirSync(assetsDir).filter(f => f.endsWith('.woff2'))
      if (woff2Files.length > 0) {
        const preloadTags = woff2Files
          .map(f => `  <link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin>`)
          .join('\n')
        html = html.replace('<head>', '<head>\n' + preloadTags)
      }
    } catch {}

    // 6b — Preconnect to key third-party origins.
    //      Saves ~360ms (Clarity) + ~320ms (AdSense) on first connection.
    const preconnectTags = [
      '  <link rel="preconnect" href="https://scripts.clarity.ms">',
      '  <link rel="dns-prefetch" href="https://www.clarity.ms">',
      '  <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>',
    ].join('\n')
    html = html.replace('<head>', '<head>\n' + preconnectTags)

    // Step 7 — overwrite dist/index.html with static HTML
    writeFileSync(resolve(ROOT, 'dist/index.html'), html, 'utf-8')
    console.log('✅ [Prerender] dist/index.html → static HTML written successfully')
    console.log('   → SEO bots, Clarity, and social previews will now see full content\n')

  } finally {
    if (browser) await browser.close()
    server.httpServer.close()
  }
}

prerender().catch((err) => {
  console.warn('\n⚠️  [Prerender] Failed — falling back to CSR build')
  console.warn(`   → Reason: ${err.message}`)
  console.warn('   → Tip: ensure Chrome deps are installed on the server:')
  console.warn('     sudo apt-get install -y libgbm1 libxkbcommon0 libasound2 libatk1.0-0 libcups2 libxdamage1\n')
  // Non-fatal: CSR build in dist/ is already valid — don't exit(1)
})
