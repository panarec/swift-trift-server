import { LngLat } from 'mapbox-gl'
import { Request } from 'express'
import { getRouteCoordinates } from '../services/mapbox/mapmatching/getRouteCoordinates'
import { NodeElement } from '../services/overpass/types'
import { getDirectionsFromNode } from '../processors/getDirectionsFromNode'

type MoveRequestObject = {
    currentPosition: [number, number]
    nextNode: NodeElement
}

export const moveHandler = async (request: Request) => {
    const requestBody = request.body

    const { currentPosition, nextNode }: MoveRequestObject = requestBody

    const routeCoordinatesBetweenCurAndNextPos = await getRouteCoordinates([
        currentPosition,
        [nextNode.lon, nextNode.lat],
    ])

    const availableDirections = await getDirectionsFromNode(nextNode)

    return JSON.stringify({
        routeCoordinates: routeCoordinatesBetweenCurAndNextPos,
        availableDirections,
    })
}
