/*
  The GitHub Contents API takes and returns base64. btoa() throws
  InvalidCharacterError on any code point above U+00FF, so the first server
  name with an em dash or an accent in it would fail without this. Encode to
  UTF-8 bytes first, then base64 those.
*/

const CHUNK = 0x8000 // keep String.fromCharCode off the argument-count limit

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function decodeBase64(base64: string): string {
  // The API returns content wrapped at 60 columns; atob rejects the newlines.
  const binary = atob(base64.replace(/\s+/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
