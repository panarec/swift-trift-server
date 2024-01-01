import { LngLat } from 'mapbox-gl'
import { NodeElement, OverpassResponse } from './types'
import { parseRequestBody, sendOverpassApiRequest } from '../../utils/overpass'

export async function getRoadsAroundPoints(coordinates: LngLat[]) {
    const points: number[][] = coordinates.map((coor) => [coor.lat, coor.lng])
    const rawQuery = {
        data: `[out:json][timeout:25];
        node(around:100.0,${points.join(',')})->.allnodes;
        foreach .allnodes ->.currentNode(
            way["highway"~"^(trunk|primary|motorway|living_street|secondary|tertiary|unclassified|residential|tertiary_link|service|motorway_junction|motorway_link|trunk_link|primary_link|secondary_link|road)$"](bn.currentNode)->.road;
            (.road;.road >;)->.road;
            node(way_link.road:3-)->.connections;
            .connections out;
        )
        `,
    }
    const requestBody = parseRequestBody(rawQuery)
    const result = await sendOverpassApiRequest(requestBody)
    return result as OverpassResponse<NodeElement>
}
