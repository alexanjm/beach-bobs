import type { ToolModule } from '../../registry/types.ts'
import { MapIcon } from '../../ui/icons.tsx'
import { CalibrateScreen } from './CalibrateScreen.tsx'
import { MapsScreen } from './MapsScreen.tsx'
import { ServerMapScreen } from './ServerMapScreen.tsx'
import { ServersScreen } from './ServersScreen.tsx'
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
  routes: [
    { path: '', element: <ServersScreen /> },
    { path: 'maps', element: <MapsScreen /> },
    { path: 'maps/:mapId/calibrate', element: <CalibrateScreen /> },
    { path: 's/:serverId', element: <ServerMapScreen /> },
  ],
  collections: [
    { name: 'maps', parse: parseMapConfig },
    { name: 'categories', parse: parseCategory },
    { name: 'servers', parse: parseServer },
    { name: 'locations', parse: parseLocation },
  ],
}
