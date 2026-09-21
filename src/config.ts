/** Where the database lives. GitHub is the database. */
export const OWNER = 'alexanjm'
export const REPO = 'beach-bobs'
export const BRANCH = 'main'

export const DATA_DIR = 'data'
export const INDEX_PATH = `${DATA_DIR}/index.json`

/** Path of a single record file. */
export function recordPath(collection: string, id: string): string {
  return `${DATA_DIR}/${collection}/${id}.json`
}

export const TOKEN_HELP_URL =
  'https://github.com/settings/tokens/new?scopes=public_repo&description=ARK%20Tools'
