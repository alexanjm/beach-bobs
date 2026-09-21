import type { ToolModule } from '../../registry/types.ts'
import { MapIcon } from '../../ui/icons.tsx'
import { MapsScreen } from './MapsScreen.tsx'
import {
  parseCategory,
  parseLocation,
  parseMapConfig,
  parseServer,
} from './types.ts'

export const scouting: ToolModule = {
  id: 'scouting',
  label: 'Scouting',
  icon: MapIcon,
  routes: [{ path: '', element: <MapsScreen /> }],
  collections: [
    { name: 'maps', parse: parseMapConfig },
    { name: 'categories', parse: parseCategory },
    { name: 'servers', parse: parseServer },
    { name: 'locations', parse: parseLocation },
  ],
}
