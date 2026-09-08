/**
 * Dexie database. Three tables, all keyed as CLAUDE.md prescribes:
 *
 *   cards     CardState by itemId (one card per content item)
 *   profile   Profile by id (there is exactly one, id 'me')
 *   sessions  SessionRecord by auto-incremented id, indexed on sessionId so a
 *             session can be found by its `${localDay}-${lessonId}-${attempt}`
 *             id and today's attempts for a lesson counted with a prefix query
 *
 * Only the keys and the sessionId index are declared; Dexie stores every other
 * property of the object as-is, so adding fields to the engine types needs no
 * schema bump. Tests construct their own instance with a distinct name, or call
 * `resetAll()` from engine/progress on the shared one.
 */
import Dexie, { type Table } from 'dexie'
import type { CardState, Profile, SessionRecord } from '../engine/types'

export const DB_NAME = 'aristocracy'

export class AristocracyDB extends Dexie {
  cards!: Table<CardState, string>
  profile!: Table<Profile, string>
  sessions!: Table<SessionRecord, number>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      cards: 'itemId',
      profile: 'id',
      sessions: '++id, sessionId',
    })
  }
}

export const db = new AristocracyDB()
