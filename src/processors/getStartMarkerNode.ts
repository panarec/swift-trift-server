import { LngLat, LngLatBounds } from "mapbox-gl"
import { NodeElement, OverpassResponse } from "../services/overpass/types"
import { getRoadsAroundPoints } from "../services/overpass/getRoadsAroundPoints"
import _ from "lodash"

export const getStartMarkerNode = async (
    node: NodeElement,
    bounds: LngLatBounds
): Promise<NodeElement | null> => {
    let loading: boolean = true

    const north = bounds.getNorth()
    const south = bounds.getSouth()
    const west = bounds.getWest()
    const east = bounds.getEast()

    let roads: OverpassResponse<NodeElement>
    let randomJunction: NodeElement

    while (loading) {
        let randomPoints: LngLat[] = []
        for (let i = 0; i < 3; i++) {
            randomPoints.push(
                new LngLat(
                    _.random(west, east, true),
                    _.random(south, north, true)
                )
            )
        }

        roads = await getRoadsAroundPoints(randomPoints)
        if (roads.elements.length > 0) {
            loading = false
            randomJunction =
                roads.elements[_.random(0, roads.elements.length - 1)]
            return randomJunction
        }
    }
    return null
}
