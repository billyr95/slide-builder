#!/usr/bin/env -S npx tsx
import puppeteer from 'puppeteer'

async function run() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  page.on('pageerror', e => console.log('pageerror:', e.message))

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
  await page.type('input[type="email"]', 'svanderpool@92ny.org')
  await page.type('input[type="password"]', 'Lexington_1395')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  await new Promise(r => setTimeout(r, 1500))
  await page.screenshot({ path: '/tmp/pp-1-initial.png' })

  // Single-click a slide row -> should select + populate preview, NOT navigate.
  const firstSlideRowClicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'))
    const row = rows.find(r => r.querySelector('svg rect')) // slide icon
    ;(row as HTMLElement | undefined)?.click()
    return row?.querySelector('td span.truncate')?.textContent ?? null
  })
  console.log('clicked slide row:', firstSlideRowClicked)
  await new Promise(r => setTimeout(r, 1200))
  console.log('url after single-click:', page.url())
  await page.screenshot({ path: '/tmp/pp-2-slide-selected.png' })

  // Single-click a folder row -> should select + show folder info in preview.
  const folderClicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'))
    const row = rows.find(r => r.querySelector('svg path[d^="M3 7a2"]')) // folder icon path
    ;(row as HTMLElement | undefined)?.click()
    return row?.querySelector('td span.truncate')?.textContent ?? null
  })
  console.log('clicked folder row:', folderClicked)
  await new Promise(r => setTimeout(r, 800))
  await page.screenshot({ path: '/tmp/pp-3-folder-selected.png' })

  await browser.close()
}

run().catch(e => { console.error(e); process.exit(1) })
