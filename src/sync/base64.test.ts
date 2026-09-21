import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64 } from './base64.ts'

describe('base64', () => {
  it('round-trips ASCII', () => {
    expect(decodeBase64(encodeBase64('hello'))).toBe('hello')
  })

  it('handles an em dash — the case that breaks bare btoa()', () => {
    const text = 'Red Peak — metal run'
    expect(() => encodeBase64(text)).not.toThrow()
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('handles accents and non-Latin scripts', () => {
    const text = 'Cañón del Río · Обелиск · 洞窟'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('handles astral-plane characters', () => {
    const text = 'loot drop 🦖 tek tier 🟦'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('round-trips a realistic record with non-ASCII in it', () => {
    const json = JSON.stringify({
      title: 'Cañón — south entrance',
      notes: 'watch the turrets – they reach the beach',
      tags: ['métal', '洞窟'],
    })
    expect(decodeBase64(encodeBase64(json))).toBe(json)
  })

  it('decodes content wrapped in newlines, as the API returns it', () => {
    const raw = encodeBase64('a longer payload that the API would wrap')
    const wrapped = raw.replace(/(.{10})/g, '$1\n')
    expect(decodeBase64(wrapped)).toBe('a longer payload that the API would wrap')
  })

  it('survives a payload larger than the chunk size', () => {
    const text = 'ü'.repeat(70_000)
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })
})
