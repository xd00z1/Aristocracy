/**
 * Documentation screenshots at a phone viewport (390 x 844), written to
 * docs/screenshots/. Not a test of anything: it only runs when SCREENSHOTS=1
 * is set, so the ordinary `npm run e2e` skips it.
 *
 *   SCREENSHOTS=1 CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/screenshots.spec.ts
 */
import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { dropTheNeedle, openToday, runSession, seedCity, watchErrors } from './helpers'

const ENABLED = process.env.SCREENSHOTS === '1'

test.describe('Screenshots', { tag: '@screenshots' }, () => {
  test.skip(!ENABLED, 'Set SCREENSHOTS=1 to capture documentation screenshots')
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

  test('Today, Drop the Needle, the Remark, the Summary, the Estate and the Tour', async ({ page }) => {
    const errors = watchErrors(page)
    // Anchor on the config file: config.rootDir is the test directory, not the repo.
    const { configFile } = test.info().config
    const repo = configFile ? path.dirname(configFile) : process.cwd()
    const dir = path.join(repo, 'docs', 'screenshots')
    mkdirSync(dir, { recursive: true })
    const shot = (name: string) => page.screenshot({ path: path.join(dir, `${name}.png`) })

    // Today, as a first visit sees it.
    await openToday(page)
    await shot('today')

    // Vienna's first lesson holds two themed works, so Drop the Needle is certain to appear.
    await seedCity(page, 'vienna', 'Vienna')

    const captured = new Set<string>()
    await runSession(page, async (type) => {
      if (captured.has(type)) return
      if (type === 'drop-the-needle') {
        // Press play in a separate step so the progress line is in the picture; the
        // answer helper's own press restarts the theme, which is harmless.
        await dropTheNeedle(page)
        await shot('drop-the-needle')
        captured.add(type)
      } else if (type === 'remark') {
        await shot('remark')
        captured.add(type)
      }
    })
    expect([...captured].sort()).toEqual(['drop-the-needle', 'remark'])

    await shot('summary')
    await page.getByTestId('return').click()
    await expect(page.getByTestId('today-screen')).toBeVisible()

    await page.getByTestId('nav-estate').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Estate')
    await shot('estate')

    await page.getByTestId('nav-tour').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Grand Tour')
    await shot('tour')

    expect(errors).toEqual([])
  })
})
