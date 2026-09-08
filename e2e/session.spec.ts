/**
 * Drives one full twelve-slot session end to end through the data-testids
 * listed in CLAUDE.md, then checks the summary, the rank-up ceremony that the
 * first completed session earns, the return to Today, and every nav route.
 * Content is not assumed: every slot is answered by whatever its exercise type
 * demands, so the spec stays valid as items and lessons change.
 */
import { expect, test, type Page } from '@playwright/test'

const SLOTS = 12

async function answerSlot(page: Page): Promise<string> {
  const root = page.locator('[data-testid^="exercise-"]').first()
  await expect(root).toBeVisible()
  const type = (await root.getAttribute('data-testid'))!.replace('exercise-', '')

  switch (type) {
    case 'timeline': {
      // Tap every pooled entry in turn; the pool shrinks as entries are placed.
      const pool = page.locator('[data-testid^="timeline-entry-"]')
      const count = await pool.count()
      for (let i = 0; i < count; i++) await pool.first().click()
      await expect(page.getByTestId('timeline-submit')).toBeEnabled()
      await page.getByTestId('timeline-submit').click()
      break
    }
    case 'match': {
      const lefts = page.locator('[data-testid^="match-left-"]:not([data-testid="match-left-column"])')
      const ids = (await lefts.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!))).map((id) => id.replace('match-left-', ''))
      for (const id of ids) {
        await page.getByTestId(`match-left-${id}`).click()
        await page.getByTestId(`match-right-${id}`).click()
      }
      break
    }
    case 'apocrypha':
      await page.getByTestId('apocrypha-attested').click()
      break
    default:
      // Choice exercises and the Remark share option-<id> buttons.
      await page.locator('[data-testid^="option-"]').first().click()
  }

  await expect(page.getByTestId('feedback')).toBeVisible()
  return type
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // Fresh household for every test: IndexedDB is per-origin.
  await page.evaluate(async () => {
    const names = (await indexedDB.databases?.()) ?? []
    await Promise.all(names.map((d) => new Promise<void>((resolve) => {
      if (!d.name) return resolve()
      const req = indexedDB.deleteDatabase(d.name)
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })))
  })
  await page.reload()
})

test('a full session runs from Today to the Summary and back', async ({ page }) => {
  await expect(page.getByTestId('today-screen')).toBeVisible()
  await expect(page.getByTestId('today-city')).not.toBeEmpty()
  await page.getByTestId('begin-session').click()

  const seen: string[] = []
  for (let slot = 1; slot <= SLOTS; slot++) {
    await expect(page.getByTestId('slot-label')).toHaveText(`${slot} of ${SLOTS}`)
    seen.push(await answerSlot(page))
    await page.getByTestId('continue').click()
  }

  // The first completed session makes a Gentleman: the ceremony precedes the summary.
  const rankUp = page.getByTestId('rank-up-screen')
  const summary = page.getByTestId('session-summary')
  await expect(rankUp.or(summary)).toBeVisible()
  if (await rankUp.isVisible()) {
    await expect(page.getByTestId('rank-up-name')).not.toBeEmpty()
    await page.getByTestId('rank-up-continue').click()
  }
  await expect(summary).toBeVisible()
  await expect(page.getByTestId('summary-grade')).not.toBeEmpty()
  await expect(page.getByTestId('summary-correct')).toContainText(`of ${SLOTS}`)

  // Slot 10 is the Remark and slot 11 a set piece whenever content allows.
  expect(seen).toHaveLength(SLOTS)
  expect(seen[9]).toBe('remark')
  expect(['timeline', 'match']).toContain(seen[10])

  await page.getByTestId('return').click()
  await expect(page.getByTestId('today-screen')).toBeVisible()
  await expect(page.getByTestId('meter-standing')).toContainText('1')
  await expect(page.getByTestId('nav-today')).toBeVisible()
})

test('every household room opens from the nav', async ({ page }) => {
  await page.getByTestId('nav-estate').click()
  await expect(page).toHaveURL(/\/estate$/)
  await expect(page.locator('[data-testid^="room-"]').first()).toBeVisible()

  await page.getByTestId('nav-tour').click()
  await expect(page).toHaveURL(/\/tour$/)
  await expect(page.locator('[data-testid^="tour-city-"]').first()).toBeVisible()

  await page.getByTestId('nav-collection').click()
  await expect(page).toHaveURL(/\/collection$/)
  await expect(page.getByTestId('collection-empty')).toBeVisible()

  await page.getByTestId('nav-settings').click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByTestId('sound-toggle')).toBeVisible()

  await page.getByTestId('nav-today').click()
  await expect(page.getByTestId('begin-session')).toBeVisible()
})
