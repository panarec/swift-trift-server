import { Repository, Schema } from 'redis-om'
import { client } from '../cache/redisClient'
import { v4 } from 'uuid'
import { lobbyRepository } from '../cache/schemas/lobby'

export const getLobby = async (lobbyNumber: string) => {
    const lobbyNumbers = 'yourarethebest'
    const obj = {
        lobbyNumber: lobbyNumbers,
        id: v4(),
        game: { gameParams: { currentLevel: 1 } },
    }
    await client.set(lobbyNumbers, JSON.stringify(obj))
    const value = await client.get(lobbyNumbers)
    return value
}
