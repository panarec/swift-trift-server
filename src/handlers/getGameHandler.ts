import { getRandomCity } from '../utils/cityData'
import { getCityById } from '../services/overpass/getCityById'
import { NodeElement } from '../services/overpass/types'
import { LngLat } from 'mapbox-gl'
import { getStartMarkerNode } from '../processors/getStartMarkerNode'
import { getFinnishMarkerNode } from '../processors/getFinnishMarkerNode'
import { Request } from 'express'
import { getDirectionsFromNode } from '../processors/getDirectionsFromNode'

export const getGameHandler = async (request: Request) => {
    let startMarkerPosition: LngLat
    let startMarkerNode: NodeElement | null

    let finnishMarkerPosition: LngLat
    let finnishMarkerNode: NodeElement
    const reqBody = request.body

    const randomCityId = await getRandomCity()
    const randomCityMetadata = await getCityById(randomCityId)
    const cityNode = randomCityMetadata.elements[0]
    const maxRadius = cityNode.tags.population
        ? cityNode.tags.population / 60
        : 1000
    const bounds = getBoundsOfNodeWithRadius(cityNode, maxRadius)

    startMarkerNode = await getStartMarkerNode(cityNode, bounds)

    if (startMarkerNode) {
        startMarkerPosition = new LngLat(
            startMarkerNode.lon,
            startMarkerNode.lat
        )
        finnishMarkerNode = await getFinnishMarkerNode(
            startMarkerPosition,
            maxRadius,
            reqBody.currentLevel
        )
        finnishMarkerPosition = new LngLat(
            finnishMarkerNode.lon,
            finnishMarkerNode.lat
        )

        const availableDirections = await getDirectionsFromNode(startMarkerNode)

        const gameParams = {
            startMarkerPosition,
            finnishMarkerPosition,
            startMarkerNode,
            finnishMarkerNode,
            availableDirections,
        }
        const response = JSON.stringify(gameParams)
        return response
    }
    return null
}

const getBoundsOfNodeWithRadius = (node: NodeElement, radius: number) => {
    const bounds = new LngLat(node.lon, node.lat).toBounds(radius)
    return bounds
}
