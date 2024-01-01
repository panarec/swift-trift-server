import { getRouteCoordinates } from '../services/mapbox/mapmatching/getRouteCoordinates'
import { NodeElement } from '../services/overpass/types'
import { Request } from 'express'

type FinnishRequestBody = {
    startPosition: [number, number]
    finnishPosition: [number, number]
    userRouteCoordinates: [number, number][]
}

export const finnishGameHandler = async (request: Request) => {
    const requestBody = request.body

    const {
        startPosition,
        finnishPosition,
        userRouteCoordinates,
    }: FinnishRequestBody = request.body

    const userRoute = await getRouteCoordinates(userRouteCoordinates)
    const finalRoute = await getRouteCoordinates([
        startPosition,
        finnishPosition,
    ])

    const userRouteDistance = userRoute.distance
    const correctRouteDistance = finalRoute.distance

    return {
        userRoute: userRoute.geometry.coordinates,
        userRouteDistance,
        correctRoute: finalRoute.geometry.coordinates,
        correctRouteDistance: finalRoute.distance
    }
}
