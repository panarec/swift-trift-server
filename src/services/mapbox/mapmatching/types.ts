export type MappingObject = {
    matchings: MatchObject[]
    tracepoints: Tracepoint[]
    code: 'Ok'
    uuid: string
}

export type Tracepoint = {
    matchings_index: number
    waypoint_index: number
    alternatives_count: number
    distance: number
    name: string
    location: [number, number]
}

export type MatchObject = {
    confidence: number
    weight_name: string
    weight: number
    duration: number
    distance: number
    legs: Leg[]
    geometry: GeoJSON.LineString
}
export type Leg = {
    via_waypoints: []
    admins: [
        {
            iso_3166_1_alpha3: string
            iso_3166_1: string
        },
    ]
    weight: number
    duration: number
    steps: []
    distance: number
    summary: string
}
