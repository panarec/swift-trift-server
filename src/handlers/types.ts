import { LngLat } from 'mapbox-gl'
import { NodeElement } from '../services/overpass/types'

export type GameParams = {
    startMarkerPosition: LngLat
    finnishMarkerPosition: LngLat
    startMarkerNode: NodeElement
    finnishMarkerNode: NodeElement
    availableDirections: NodeElement[]
}
