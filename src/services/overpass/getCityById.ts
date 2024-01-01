import { parseRequestBody, sendOverpassApiRequest } from '../../utils/overpass'
import { NodeElement, OverpassResponse, RelationElement } from './types'

export const getCityById = async (cityId: number) => {
    const rawQuery = {
        data: `[out:json][timeout:25];
        node(${cityId})->.city;
        rel(bn.city)->.areas;
        (.city; .areas;)->.union;
        .union out geom;`,
    }

    const requestBody = parseRequestBody(rawQuery)
    const result: OverpassResponse<RelationElement & NodeElement> =
        await sendOverpassApiRequest(requestBody)
    return result
}
