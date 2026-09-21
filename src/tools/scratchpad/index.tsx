import type { ToolModule } from '../../registry/types.ts'
import { NoteIcon } from '../../ui/icons.tsx'
import { ScratchpadScreen } from './ScratchpadScreen.tsx'
import { parseNote } from './types.ts'

/*
  The seam-prover. Deliberately trivial: shared notes, one collection, one
  screen. It exists to show that a tool is a folder plus a registry entry, and
  to exercise the whole persistence path — create, edit, delete, conflict,
  attribution — before the map tool depends on it.
*/

export const scratchpad: ToolModule = {
  id: 'scratchpad',
  label: 'Scratchpad',
  icon: NoteIcon,
  routes: [{ path: '', element: <ScratchpadScreen /> }],
  collections: [{ name: 'notes', parse: parseNote }],
}
