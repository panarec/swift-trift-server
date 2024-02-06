import { LngLat } from 'mapbox-gl'
import { NodeElement } from '../services/overpass/types'

export type PlayerItem = {
    playerName: string
    socketId: string
    ready: boolean
    totalTime: number
    score: number
    color: string
    finished: boolean
    routeCoordinates: number[][]
    distance: number
    lastLevelscore: number
    lastLevelTime: number
}

export type LobbyItem = {
    lobbyNumber: string
    players: PlayerItem[]
    game: {
        gameParams: GameParams | null
        gameOptions: GameOptions
    }
}
export type GameOptions = {
    timeLimit: number
    levelsPerGame: number
    difficulty: 'veryEasy' | 'easy' | 'normal' | 'hard' | 'extreme'
    gameStarted: boolean
}

export type GameParams = {
    startMarkerPosition: LngLat
    finnishMarkerPosition: LngLat
    startMarkerNode: NodeElement
    finnishMarkerNode: NodeElement
    availableDirections: NodeElement[]
    currentLevel: number
}
