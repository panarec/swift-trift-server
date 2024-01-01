export type OverpassResponse<ElementsType> = {
    elements: ElementsType[]
    generator: string
    osm3s: any
    version: number
}
export type RelationElement = {
    bounds: {
        maxlat: number
        maxlon: number
        minlat: number
        minlon: number
    }
    id: number
    nodes: number[]
    tags: any
    type: string
}
export type NodeElement = {
    id: number
    lat: number
    lon: number
    tags: any
    type: string
}

export type RoadElement = {
    geometry: {
        lat: number
        lon: number
    }[]
    id: number
    nodes: number[]
    tags: any
    type: string
}
