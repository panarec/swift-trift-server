import { LngLat } from 'mapbox-gl'
import { NodeElement, OverpassResponse } from '../services/overpass/types'
import { getRoadsAroundPoints } from '../services/overpass/getRoadsAroundPoints'
import _ from 'lodash'

export const getFinnishMarkerNode = async (
    startMarkerPosition: LngLat,
    maxRadius: number,
    currentLevel: number = 1
): Promise<NodeElement> => {
    let loading: boolean = true
    let minRadius = 0.002 + (currentLevel - 1) / 10000
    const minimumBounds = startMarkerPosition.toBounds(minRadius)
    let roads: OverpassResponse<NodeElement>
    let finnishNode: NodeElement = {
        id: 0,
        lat: 0,
        lon: 0,
        tags: undefined,
        type: '',
    }
    let points = []
    while (loading) {
        for (let i = 0; i < 360; i++) {
            points.push(
                new LngLat(
                    minRadius * Math.sin(i) * 1.3 + startMarkerPosition.lng,
                    minRadius * Math.cos(i) + startMarkerPosition.lat
                )
            )
        }
        roads = await getRoadsAroundPoints(points)
        if (roads.elements.length > 0) {
            loading = false
            const foundNode: NodeElement =
                roads.elements[_.random(0, roads.elements.length - 1)]
            if (
                foundNode.lat !== startMarkerPosition.lat &&
                foundNode.lon !== startMarkerPosition.lng
            ) {
                finnishNode = foundNode
            }
        } else {
            minRadius += 0.0001
        }
    }

    return finnishNode
}
