import { MappingObject, MatchObject } from './types'

export const getRouteCoordinates = async (
    routePath: number[][]
): Promise<MatchObject> => {
    const reqCoordinates = routePath.join(';')
    console.log({reqCoordinates})
    const radiuses = routePath.map(() => '1').join(';')
    let response
    try {
        response = await fetch(
            `https://api.mapbox.com/matching/v5/mapbox/driving/${reqCoordinates}?geometries=geojson&ignore=oneways,restrictions&radiuses=${radiuses}&access_token=pk.eyJ1IjoicGFuYXJlYyIsImEiOiJja3ZjZXBmMDAwNHlqMzBuM2lrZTQ4MDhmIn0.XLnuvSXKToRxsVNR0WHaKg`
        )

        const coords = (await response.json()) as MappingObject
        console.log(coords)
        return coords.matchings[0]
    } catch (e) {
        throw new Error((e as Error).message)
    }
}
