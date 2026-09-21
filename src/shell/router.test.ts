import { describe, expect, it } from 'vitest'
import { match } from './router.ts'

describe('match', () => {
  it('matches a literal path', () => {
    expect(match('/scouting', '/scouting')).toEqual({})
  })

  it('ignores leading and trailing slashes', () => {
    expect(match('scouting/', '/scouting')).toEqual({})
  })

  it('captures params', () => {
    expect(match('/scouting/servers/:id', '/scouting/servers/abc')).toEqual({
      id: 'abc',
    })
  })

  it('decodes param values', () => {
    expect(match('/s/:name', '/s/Red%20Peak')).toEqual({ name: 'Red Peak' })
  })

  it('rejects a length mismatch', () => {
    expect(match('/scouting', '/scouting/servers')).toBeNull()
    expect(match('/scouting/servers', '/scouting')).toBeNull()
  })

  it('rejects a literal mismatch', () => {
    expect(match('/scouting/:id', '/breeding/abc')).toBeNull()
  })
})
