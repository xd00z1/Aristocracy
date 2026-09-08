/**
 * Everything the session screens take from sibling modules, in one place so
 * tests can replace it with `vi.mock('./session/deps')` before the real
 * modules exist or without touching IndexedDB.
 */
export { completeSession, loadProfile, recordAnswer, startSession } from '../../engine/progress'
export { EXERCISE_COMPONENTS } from '../../exercises'
export { getItem, hasImage, imageUrl } from '../../content'
