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
import { writeFileSync } from 'fs'
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

    // Step 4 — reset animated text to initial GSAP state before capturing
    // Puppeteer captures AFTER GSAP has already run (networkidle0 waits long enough).
    // Without this reset, prerendered HTML has opacity:1 text → React hydrates →
    // GSAP resets to opacity:0 → visible flash → animation plays.
    // With this reset, prerendered HTML matches GSAP "from" state → no flash.
    await page.evaluate(() => {
      document.querySelectorAll('.word-inner').forEach((el) => {
        el.style.opacity = '0'
        el.style.transform = 'translateY(110%) rotateX(-40deg)'
      })
    })

    // Step 5 — capture fully rendered HTML
    // page.content() returns the live DOM — includes:
    //   • Full React-rendered landing page HTML
    //   • react-helmet-async meta tags injected into <head>
    //   • ClarityAnalytics <script> tag
    //   • Vite JS bundle <script> tags (React hydrates on top after load)
    const html = await page.content()

    // Step 5 — overwrite dist/index.html with static HTML
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
