import { scouting } from '../tools/scouting/index.tsx'
import { scratchpad } from '../tools/scratchpad/index.tsx'
import type { ToolModule } from './types.ts'

/*
  Every tool in the app. Adding one is: drop a folder in src/tools, export a
  ToolModule, add it here. Nothing else in the shell needs to know about it.
*/
export const TOOLS: ToolModule[] = [scouting, scratchpad]

export function toolById(id: string): ToolModule | undefined {
  return TOOLS.find((t) => t.id === id)
}
