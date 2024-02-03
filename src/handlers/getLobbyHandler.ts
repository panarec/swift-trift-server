import { Request } from 'express'
import { getLobby } from '../processors/getLobby'

export const getLobbyHandler = async (request: Request) => {
    const lobbyNumber = request.params.lobbyNumber
    const lobby = await getLobby(lobbyNumber)
    return lobby
}