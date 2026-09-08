/**
 * Shared Playwright helpers. Everything here drives the app through the
 * data-testids that CLAUDE.md declares as the contract; nothing about the
 * content is assumed, so the specs stay valid as lessons change.
 */
import { expect, type Page } from '@playwright/test'

export const SLOTS = 12
export const GRADES = ['First', 'Upper Second', 'Lower Second', 'Third', 'Pass']
export const CHOICE_TYPES = ['identify', 'lexicon', 'whos-who', 'zoom-out']

/** Collect uncaught errors and console.error lines; a session must produce none. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
  })
  return errors
}

export async function openToday(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('today-screen')).toBeVisible()
  await expect(page.getByTestId('begin-session')).toBeVisible()
}

/**
 * Point the household at another city. The profile row lives in the Dexie
 * database `aristocracy`, table `profile`, key `me`; Today has already created
 * it, so it is only edited here, then the page is reloaded.
 */
export async function seedCity(page: Page, cityId: string, cityName: string): Promise<void> {
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('aristocracy')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('profile', 'readwrite')
          const store = tx.objectStore('profile')
          const get = store.get('me')
          get.onsuccess = () => {
            if (!get.result) {
              reject(new Error('no profile row to seed'))
              return
            }
            store.put({ ...get.result, currentCityId: id })
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    cityId,
  )
  await page.reload()
  await expect(page.getByTestId('today-screen')).toBeVisible()
  await expect(page.getByTestId('today-city')).toHaveText(cityName)
}

export interface SlotResult {
  type: string
  /** Drop the Needle only: whether the play button was enabled and pressed. */
  played?: boolean
}

/** The exercise type on screen, from the root's `exercise-<type>` testid. */
export async function currentExerciseType(page: Page): Promise<string> {
  const root = page.locator('[data-testid^="exercise-"]').first()
  await expect(root).toBeVisible()
  return (await root.getAttribute('data-testid'))!.replace('exercise-', '')
}

/**
 * Press play on Drop the Needle. Returns true when the theme was started
 * (the button was enabled and the progress line appeared); false when sound
 * is off or the work has no theme, in which case the clue must be showing.
 */
export async function dropTheNeedle(page: Page): Promise<boolean> {
  const play = page.getByTestId('play-theme')
  await expect(play).toBeVisible()
  if (await play.isEnabled()) {
    await play.click()
    await expect(page.getByTestId('theme-progress')).toBeVisible()
    return true
  }
  await expect(page.getByTestId('choice-notice')).toBeVisible()
  await expect(page.getByTestId('theme-clue')).toBeVisible()
  return false
}

/** Answer whatever exercise is on screen, by its root testid, and wait for the feedback. */
export async function answerSlot(page: Page): Promise<SlotResult> {
  const type = await currentExerciseType(page)
  const result: SlotResult = { type }

  switch (type) {
    case 'drop-the-needle':
      result.played = await dropTheNeedle(page)
      await page.locator('[data-testid^="option-"]').first().click()
      break
    case 'apocrypha':
      await page.getByTestId('apocrypha-invented').click()
      break
    case 'remark':
      await expect(page.locator('[data-testid^="option-"]')).toHaveCount(3)
      await page.locator('[data-testid^="option-"]').first().click()
      break
    case 'timeline': {
      const entries = page.locator('[data-testid^="timeline-entry-"]')
      const ids = await entries.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!))
      expect(ids.length).toBeGreaterThanOrEqual(3)
      await expect(page.getByTestId('timeline-submit')).toBeDisabled()
      for (const id of ids) await page.getByTestId(id).click()
      await expect(page.getByTestId('timeline-submit')).toBeEnabled()
      await page.getByTestId('timeline-submit').click()
      break
    }
    case 'match': {
      const lefts = page.locator('[data-testid^="match-left-"]:not([data-testid="match-left-column"])')
      const ids = (await lefts.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!))).map((id) =>
        id.replace('match-left-', ''),
      )
      expect(ids.length).toBeGreaterThanOrEqual(3)
      for (const id of ids) {
        await page.getByTestId(`match-left-${id}`).click()
        await page.getByTestId(`match-right-${id}`).click()
      }
      break
    }
    default: {
      expect(CHOICE_TYPES, `unknown exercise type ${type}`).toContain(type)
      await expect(page.locator('[data-testid^="option-"]')).toHaveCount(4)
      await page.locator('[data-testid^="option-"]').first().click()
    }
  }

  await expect(page.getByTestId('feedback')).toBeVisible()
  return result
}

/** After the twelfth Continue: pass the rank-up ceremony when there is one and land on the Summary. */
export async function reachSummary(page: Page): Promise<string> {
  const rankUp = page.getByTestId('rank-up-screen')
  const summary = page.getByTestId('session-summary')
  await expect(rankUp.or(summary)).toBeVisible()
  if (await rankUp.isVisible()) {
    await expect(page.getByTestId('rank-up-name')).not.toBeEmpty()
    await page.getByTestId('rank-up-continue').click()
  }
  await expect(summary).toBeVisible()
  const grade = (await page.getByTestId('summary-grade').textContent())!.trim()
  expect(GRADES).toContain(grade)
  await expect(page.getByTestId('summary-correct')).toContainText(`of ${SLOTS}`)
  return grade
}

/**
 * From Today, run all twelve slots and land on the Summary. `beforeAnswer`
 * runs once a slot is on screen, before it is answered (screenshots use it).
 */
export async function runSession(
  page: Page,
  beforeAnswer?: (type: string, slot: number) => Promise<void>,
): Promise<{ slots: SlotResult[]; grade: string }> {
  await page.getByTestId('begin-session').click()

  const slots: SlotResult[] = []
  for (let slot = 1; slot <= SLOTS; slot++) {
    await expect(page.getByTestId('slot-label')).toHaveText(`${slot} of ${SLOTS}`)
    if (beforeAnswer) await beforeAnswer(await currentExerciseType(page), slot)
    slots.push(await answerSlot(page))
    await page.getByTestId('continue').click()
  }

  const grade = await reachSummary(page)

  // Slot 10 is the Remark; slot 11 a set piece whenever the content allows.
  const types = slots.map((s) => s.type)
  expect(types).toHaveLength(SLOTS)
  expect(types[9]).toBe('remark')
  expect(['timeline', 'match']).toContain(types[10])

  return { slots, grade }
}

/** A fresh load of Today after exactly one session: the day counts and the lesson has advanced. */
export async function expectTodayAfterOneSession(page: Page, lessonBefore: string): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('today-screen')).toBeVisible()
  await expect(page.getByTestId('meter-standing')).toHaveText(/Standing\s*1\s*day$/)
  const lessonAfter = (await page.getByTestId('today-lesson').textContent())!.trim()
  expect(lessonAfter).not.toBe(lessonBefore)
  expect(lessonAfter).toMatch(/^Lesson 2 of \d+/)
}
