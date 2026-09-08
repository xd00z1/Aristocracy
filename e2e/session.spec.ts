/**
 * End-to-end: one twelve-slot session driven purely through the data-testids
 * that CLAUDE.md declares as the contract, with the rooms, the Standing meter
 * and lesson progress checked afterwards; then the same session with sound
 * switched off in Settings, and once more with sound on so Drop the Needle
 * is played for real.
 *
 * The first test runs the true first-run experience (London, lesson 1, the
 * rank-up ceremony). The other two seed the profile onto Vienna, whose first
 * lesson holds two themed works and an apocrypha, so Drop the Needle and
 * Apocrypha are exercised whichever way the seed falls.
 */
import { expect, test, type Page } from '@playwright/test'
import { expectTodayAfterOneSession, openToday, runSession, seedCity, watchErrors } from './helpers'

const errorLogs = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
  errorLogs.set(page, watchErrors(page))
})

test.afterEach(({ page }) => {
  expect(errorLogs.get(page) ?? []).toEqual([])
})

test('a full session runs from Today to the Summary, every room opens, and the day is counted', async ({ page }) => {
  await openToday(page)
  await expect(page.getByTestId('today-city')).not.toBeEmpty()
  await expect(page.getByTestId('meter-standing')).toHaveText(/Standing\s*0\s*days$/)
  const lessonBefore = (await page.getByTestId('today-lesson').textContent())!.trim()
  expect(lessonBefore).toMatch(/^Lesson 1 of \d+/)

  const { slots, grade } = await runSession(page)
  console.log(`[e2e] first-run session: grade ${grade}; slots ${slots.map((s) => s.type).join(', ')}`)

  await page.getByTestId('return').click()
  await expect(page.getByTestId('today-screen')).toBeVisible()

  // Every room opens from the bottom bar and shows its heading.
  await page.getByTestId('nav-estate').click()
  await expect(page).toHaveURL(/\/estate$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Estate')

  await page.getByTestId('nav-tour').click()
  await expect(page).toHaveURL(/\/tour$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Grand Tour')

  await page.getByTestId('nav-collection').click()
  await expect(page).toHaveURL(/\/collection$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Collection')

  await page.getByTestId('nav-settings').click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')

  await page.getByTestId('nav-today').click()
  await expect(page.getByTestId('begin-session')).toBeVisible()

  // A fresh load of Today: the day counts and the lesson has advanced.
  await expectTodayAfterOneSession(page, lessonBefore)
})

test('a session with sound switched off in Settings is still completable', async ({ page }) => {
  await openToday(page)
  await seedCity(page, 'vienna', 'Vienna')
  const lessonBefore = (await page.getByTestId('today-lesson').textContent())!.trim()

  await page.getByTestId('nav-settings').click()
  const toggle = page.getByTestId('sound-toggle')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  await page.getByTestId('nav-today').click()
  await expect(page.getByTestId('begin-session')).toBeVisible()

  const { slots, grade } = await runSession(page)
  console.log(`[e2e] sound-off session: grade ${grade}; slots ${slots.map((s) => s.type).join(', ')}`)

  const needles = slots.filter((s) => s.type === 'drop-the-needle')
  expect(needles.length).toBeGreaterThan(0)
  for (const needle of needles) expect(needle.played).toBe(false)
  expect(slots.map((s) => s.type)).toContain('apocrypha')

  await page.getByTestId('return').click()
  await expectTodayAfterOneSession(page, lessonBefore)

  // The setting survives the session.
  await page.getByTestId('nav-settings').click()
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-checked', 'false')
})

test('with sound on, Drop the Needle plays the theme before it is answered', async ({ page }) => {
  await openToday(page)
  await seedCity(page, 'vienna', 'Vienna')

  const { slots, grade } = await runSession(page)
  console.log(`[e2e] sound-on session: grade ${grade}; slots ${slots.map((s) => s.type).join(', ')}`)

  const needles = slots.filter((s) => s.type === 'drop-the-needle')
  expect(needles.length).toBeGreaterThan(0)
  for (const needle of needles) expect(needle.played).toBe(true)
})
