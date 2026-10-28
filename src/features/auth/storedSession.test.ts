import { describe, expect, it } from 'vitest'
import { parseStoredSession } from './storedSession'

const valid = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'u1', email: 'x@y.de' } }

describe('gespeicherte Session', () => {
  it('erkennt eine gespeicherte Session, auch mit abgelaufenem Token', () => {
    expect(parseStoredSession(JSON.stringify(valid))?.user.id).toBe('u1')
  })

  it('verwirft leere, kaputte oder unvollständige Einträge', () => {
    expect(parseStoredSession(null)).toBeNull()
    expect(parseStoredSession('{kaputt')).toBeNull()
    expect(parseStoredSession(JSON.stringify({ ...valid, refresh_token: undefined }))).toBeNull()
    expect(parseStoredSession(JSON.stringify({ ...valid, user: { id: '' } }))).toBeNull()
    expect(parseStoredSession(JSON.stringify([valid]))).toBeNull()
  })
})
