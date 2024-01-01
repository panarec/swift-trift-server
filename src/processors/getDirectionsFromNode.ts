import { getRoadsOfNode } from '../services/overpass/getRoadsOfNode'
import { NodeElement, RoadElement } from '../services/overpass/types'

export const getDirectionsFromNode = async (
    currentJunctionNode: NodeElement
) => {
    const roads = await getRoadsOfNode(currentJunctionNode)

    const juctionNodes: NodeElement[] = roads.elements.filter(
        (element) => element.type === 'node'
    )
    const ways: RoadElement[] = roads.elements.filter(
        (element) => element.type === 'way'
    )

    let availableJunctions: NodeElement[] = []
    console.log({ ways })
    for (const way of ways) {
        const closestWayJunctions = await getClosesJunctionsOfWay(
            way,
            juctionNodes,
            currentJunctionNode
        )
        availableJunctions.push(...closestWayJunctions)
    }
    availableJunctions = availableJunctions.filter(
        (junction) => junction.id !== currentJunctionNode.id
    )
    console.log({ availableJunctions })

    return availableJunctions
}

async function getClosesJunctionsOfWay(
    way: RoadElement,
    juctionNodes: NodeElement[],
    currentJunctionNode: NodeElement
) {
    let foundJunctionNodes: NodeElement[] = []
    const currentJunctionIndex = way.nodes.findIndex(
        (el) => el === currentJunctionNode.id
    )
    // Check if way of current junction node has more directions
    if (currentJunctionIndex > 0) {
        let foundNode: NodeElement | undefined
        for (let i = currentJunctionIndex; i > 0; i--) {
            foundNode = juctionNodes.find(
                (node) => node.id === way.nodes[i - 1]
            )
            if (foundNode) {
                foundJunctionNodes.push(foundNode)
                break
            }
        }
        if (!foundNode) {
            const nodes = await getAllNodesOfWay(way)

            const foundNode = nodes.find((nd) => nd.id === way.nodes[0])
            if (foundNode) foundJunctionNodes.push(foundNode)
        }
    }
    let foundNode: NodeElement | undefined
    for (let i = currentJunctionIndex; i < way.nodes.length - 1; i++) {
        foundNode = juctionNodes.find((node) => node.id === way.nodes[i + 1])
        if (foundNode) {
            foundJunctionNodes.push(foundNode)
            break
        }
    }
    if (!foundNode) {
        const nodes = await getAllNodesOfWay(way)
        const foundNode = nodes.find(
            (nd) => nd.id === way.nodes[nodes.length - 1]
        )
        if (foundNode) foundJunctionNodes.push(foundNode)
    }
    return foundJunctionNodes
}

const getAllNodesOfWay = (way: RoadElement) => {
    const roadNodes = way.nodes.map((node, index) => ({
        id: node,
        lat: way.geometry[index].lat,
        lon: way.geometry[index].lon,
        tags: '',
        type: 'node',
    })) as NodeElement[]

    return roadNodes
}
