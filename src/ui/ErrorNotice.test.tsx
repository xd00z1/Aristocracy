/**
 * The error state speaks the house language. Storage libraries do not: Dexie's
 * missing-API error is a doubled sentence with a shortened link in it, and a
 * product that tells its reader to visit a tinyurl has lost the tone.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorNotice, describeError } from './ErrorNotice'

afterEach(cleanup)

describe('describeError', () => {
  it('turns a storage failure into one house sentence, with no link', () => {
    const dexie = new Error('IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb')
    dexie.name = 'MissingAPIError'
    const line = describeError(dexie)
    expect(line).toBe('This browser will not let the app keep records. Private browsing often does that.')
    expect(line).not.toMatch(/http|tinyurl|visit/i)
  })

  it('names a full disk plainly', () => {
    const quota = new Error('QuotaExceededError: the quota has been exceeded')
    expect(describeError(quota)).toBe('There is no room left on this device to keep records.')
  })

  it('keeps an ordinary message, minus any link it carries', () => {
    expect(describeError(new Error('The ink has run out'))).toBe('The ink has run out')
    expect(describeError(new Error('Something broke. Please visit https://example.com/help'))).toBe('Something broke.')
  })

  it('has something to say about nothing at all', () => {
    expect(describeError(undefined)).toBe('An unknown fault.')
    expect(describeError(new Error(''))).toBe('An unknown fault.')
  })
})

describe('ErrorNotice', () => {
  it('is an alert with the line, the detail and a retry', () => {
    const onRetry = vi.fn()
    render(<ErrorNotice message="Your household records could not be opened." detail={new Error('The ink has run out')} onRetry={onRetry} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Your household records could not be opened.')
    expect(alert.textContent).toContain('The ink has run out')
    fireEvent.click(screen.getByText('Try again'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
