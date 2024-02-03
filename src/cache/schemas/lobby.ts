import { Repository, Schema } from 'redis-om'
import { client } from '../redisClient'

const lobbySchema = new Schema('lobby', {
    lobbyNumber: { type: 'string' },

    playerName: { type: 'string', path: '$.players.playerName' },
    socketId: { type: 'string', path: '$.players.socketId' },
    ready: { type: 'boolean', path: '$.players.ready' },
    totalTime: { type: 'number', path: '$.players.totalTime' },
    score: { type: 'number', path: '$.players.score' },
    color: { type: 'string', path: '$.players.color' },
    distance: { type: 'number', path: '$.players.distance' },
    lastLevelscore: { type: 'number', path: '$.players.lastLevelscore' },
    lastLevelTime: { type: 'number', path: '$.players.lastLevelTime' },
    finished: { type: 'boolean', path: '$.players.finished' },
    routeCoordinates: {
        type: 'number[]',
        path: '$.players.routeCoordinates[*]',
    },

    timeLimit: { type: 'number', path: '$.game.gameOptions.timeLimit' },
    levelsPerGame: { type: 'number', path: '$.game.gameOptions.levelsPerGame' },
    difficulty: { type: 'string', path: '$.game.gameOptions.difficulty' },

})
console.log(lobbySchema.fields)

export const lobbyRepository = new Repository(lobbySchema, client)
lobbyRepository.createIndex()
