// Renders public/favicon.svg to the PNG icons the PWA manifest lists.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:#f6f1e7">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } })
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), buf)
  console.log(`icon-${size}.png`)
}
await browser.close()
