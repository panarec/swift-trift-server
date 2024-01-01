import { NodeElement, OverpassResponse, RoadElement } from "../services/overpass/types"

export const parseRequestBody = (body: any) => {
    let requestBodyArr: string[] = []
    for (const property in body) {
        const encodedKey = encodeURIComponent(property)
        const encodedValue = encodeURIComponent(body[property])
        requestBodyArr.push(encodedKey + '=' + encodedValue)
    }
    const requestBody = requestBodyArr.join('&')
    return requestBody
}

export const sendOverpassApiRequest = async (requestBody: string) => {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: requestBody,
    })
    const responseBody = await response.json() 
    return responseBody
}
