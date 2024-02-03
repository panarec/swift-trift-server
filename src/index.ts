import express from 'express'
import { getGameHandler } from './handlers/getGameHandler'
import cors from 'cors'
import { moveHandler } from './handlers/moveHandler'
import { finnishGameHandler } from './handlers/finnishGameHandler'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { GameOptions, GameParams, LobbyItem, PlayerItem } from './types/types'
import { v4 } from 'uuid'
import { getRouteCoordinates } from './services/mapbox/mapmatching/getRouteCoordinates'
import 'dotenv/config'
import logger, { P } from 'pino'
import { getLobbyHandler } from './handlers/getLobbyHandler'
import { lobbyRepository } from './cache/schemas/lobby'
import { client } from './cache/redisClient'
import e from 'express'

const log = logger({
    transport: {
        target: 'pino-pretty',
    },
})

const corsOptions = {
    origin: process.env.CLIENT_URL,
}

const app = express()
const port = process.env.HTTP_PORT

app.use(cors(corsOptions))
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

app.post('/getGame', async (req, res) => {
    const response = await getGameHandler(req)
    res.send(response)
})

app.post('/move', async (req, res) => {
    const response = await moveHandler(req)
    res.send(response)
})

app.post('/finnishGame', async (req, res) => {
    const response = await finnishGameHandler(req)
    res.send(response)
})
app.get('/createLobby', async (req, res) => {
    const lobby = await getLobbyHandler(req)
    res.send(lobby)
})

app.listen(port, () => {
    console.log(`Listening on port ${port}...`)
})

const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: { origin: [process.env.CLIENT_URL as string] },
})

const availableColors = ['FF9F1C', '3772FF', 'DF2935', '43E726', 'CD38FF']
const lobbyExpirationTime = 60 * 30

io.on('connection', (socket) => {
    socket.on('create-lobby', async (playerName: string, callback) => {
        const lobbyNumber = v4().split('-')[0]
        const lobby: LobbyItem = {
            lobbyNumber,
            players: [
                {
                    playerName,
                    socketId: socket.id,
                    ready: false,
                    score: 0,
                    color: availableColors[0],
                    finished: false,
                    routeCoordinates: [],
                    distance: 0,
                    totalTime: 0,
                    lastLevelscore: 0,
                    lastLevelTime: 0,
                },
            ],
            game: {
                gameParams: null,
                gameOptions: defaultGameOptions,
            },
        }

        await client.set(lobbyNumber, JSON.stringify(lobby), {
            EX: lobbyExpirationTime,
        })
        await socket.join(lobbyNumber)
        log.info(`Player ${playerName} created lobby ${lobbyNumber}`)
        callback(lobby)
    })
    socket.on(
        'join-lobby',
        async (lobbyNumber: string, playerName: string, callback) => {
            try {
                await socket.join(lobbyNumber)
                const lobby = await addPlayerToLobby(
                    lobbyNumber,
                    playerName,
                    socket.id
                )
                log.info(`Player ${playerName} joined lobby ${lobbyNumber}`)
                log.info(
                    `Lobby ${lobbyNumber} has ${lobby?.players.length} players`
                )
                callback(lobby)
                socket.to(lobbyNumber).emit('lobby-change', lobby)
            } catch (e) {
                log.error(e)
                callback(null)
            }
        }
    )
    socket.on('leave-lobby', async (lobbyNumber, callback) => {
        if (!lobbyNumber) return

        await socket.leave(lobbyNumber)

        try {
            const lobby = await removePlayerFromLobby(lobbyNumber, socket.id)
            log.info(`Player ${socket.id} left lobby ${lobbyNumber}`)
            callback()
            socket.to(lobbyNumber).emit('lobby-change', lobby)
        } catch (e) {
            log.error(e)
            callback()
        }
    })
    socket.on(
        'change-lobby-options',
        async (lobbyNumber: string, options: GameOptions) => {
            let playerLobby: string | LobbyItem | null =
                await client.get(lobbyNumber)
            log.info(
                `Player ${
                    socket.id
                } changed lobby ${lobbyNumber} options to ${JSON.stringify(
                    options
                )}`
            )

            if (playerLobby) {
                playerLobby = JSON.parse(playerLobby) as LobbyItem
                const newLobby = {
                    ...playerLobby,
                    game: {
                        gameParams: playerLobby.game.gameParams,
                        gameOptions: options,
                    },
                }
                await client.set(lobbyNumber, JSON.stringify(newLobby), {
                    EX: lobbyExpirationTime,
                })
                log.info(
                    `Lobby ${JSON.stringify(
                        lobbyNumber
                    )} options changed to ${JSON.stringify(options)}`
                )
                socket.emit('lobby-change', newLobby)
                socket.to(lobbyNumber).emit('lobby-change', newLobby)
            } else {
                log.error(`Lobby ${lobbyNumber} does not exist`)
            }
        }
    )
    socket.on(
        'game-ready',
        async (playerStatus: boolean, lobbyNumber: string) => {
            let playerLobby: string | null | LobbyItem =
                await client.get(lobbyNumber)

            if (playerLobby) {
                playerLobby = JSON.parse(playerLobby) as LobbyItem
                const newLobby = changePlayerState(
                    playerStatus,
                    socket.id,
                    playerLobby
                )

                await client.set(lobbyNumber, JSON.stringify(newLobby), {
                    EX: lobbyExpirationTime,
                })

                socket.emit('lobby-change', newLobby)
                socket.to(lobbyNumber).emit('lobby-change', newLobby)

                if (newLobby?.players.every((player) => player.ready)) {
                    socket.to(playerLobby.lobbyNumber).emit('all-ready')
                    socket.emit('all-ready')

                    const lobbyWithGame = await generateDuelGame(playerLobby)
                    client.set(lobbyNumber, JSON.stringify(lobbyWithGame), {
                        EX: lobbyExpirationTime,
                    })

                    socket
                        .to(playerLobby.lobbyNumber)
                        .emit('game-start', lobbyWithGame.game.gameParams)
                    socket.emit('game-start', lobbyWithGame.game.gameParams)
                }
            } else {
                log.error(`Lobby ${lobbyNumber} does not exist`)
            }
        }
    )

    socket.on(
        'finnish-level',
        async (
            lobbyNumber: string,
            routeCoordinates: [number, number][],
            time: number
        ) => {
            let playerLobby: string | LobbyItem | null =
                await client.get(lobbyNumber)

            if (playerLobby) {
                playerLobby = JSON.parse(playerLobby) as LobbyItem
                const player = playerLobby.players.find(
                    (player) => player.socketId === socket.id
                )
                if (player) {
                    player.finished = true
                    let playerMatchObject
                    if (routeCoordinates.length <= 1) {
                        playerMatchObject = {
                            distance: 0,
                            geometry: {
                                coordinates: [],
                            },
                        }
                    } else {
                        playerMatchObject =
                            await getRouteCoordinates(routeCoordinates)
                    }
                    player.distance = playerMatchObject.distance
                    player.routeCoordinates =
                        playerMatchObject.geometry.coordinates

                    player.totalTime =
                        player.totalTime +
                        (playerLobby.game.gameOptions.timeLimit - time)
                    player.lastLevelTime = time
                    const players = playerLobby.players
                    const finnishedPlayers = players.filter(
                        (player) => player.finished
                    )
                    if (finnishedPlayers.length === players.length) {
                        if (playerLobby.game.gameParams) {
                            const finalRoute = await getRouteCoordinates([
                                [
                                    playerLobby.game.gameParams
                                        .startMarkerPosition.lng,
                                    playerLobby.game.gameParams
                                        .startMarkerPosition.lat,
                                ],
                                [
                                    playerLobby.game.gameParams
                                        .finnishMarkerPosition.lng,
                                    playerLobby.game.gameParams
                                        .finnishMarkerPosition.lat,
                                ],
                            ])

                            const evaluatedPlayers = evaluateGame(
                                playerLobby.players,
                                finalRoute.distance
                            )
                            const currentLobby = {
                                ...playerLobby,
                                players: evaluatedPlayers,
                            }

                            client.set(
                                lobbyNumber,
                                JSON.stringify(currentLobby),
                                { EX: lobbyExpirationTime }
                            )

                            socket.to(lobbyNumber).emit('game-finnished', {
                                currentLobby,
                                finalRoute,
                            })
                            socket.emit('game-finnished', {
                                currentLobby,
                                finalRoute,
                            })
                        }
                    }
                }
            } else {
                log.error(`Lobby ${lobbyNumber} does not exist`)
            }
        }
    )
})

httpServer.listen(process.env.SOCKET_PORT)

const defaultGameOptions: GameOptions = {
    timeLimit: 30,
    levelsPerGame: 5,
    difficulty: 'normal',
}

const addPlayerToLobby = async (
    lobbyNumber: string,
    playerName: string,
    socketId: string
): Promise<LobbyItem> => {
    let existingLobby = await client.get(lobbyNumber)
    if (existingLobby) {
        const parsedExistingLobby = JSON.parse(existingLobby) as LobbyItem
        log.info(`${lobbyNumber} exists. Player ${playerName} joined.`)
        parsedExistingLobby.players.push({
            playerName,
            socketId,
            ready: false,
            score: 0,
            color: availableColors[parsedExistingLobby.players.length],
            finished: false,
            routeCoordinates: [],
            distance: 0,
            totalTime: 0,
            lastLevelscore: 0,
            lastLevelTime: 0,
        })
        await client.set(lobbyNumber, JSON.stringify(parsedExistingLobby), {
            EX: lobbyExpirationTime,
        })
        return parsedExistingLobby
    }
    throw new Error(`Lobby ${lobbyNumber} does not exist`)
}

const removePlayerFromLobby = async (lobbyNumber: string, socketId: string) => {
    let lobby: string | LobbyItem | null = await client.get(lobbyNumber)
    if (lobby) {
        lobby = JSON.parse(lobby) as LobbyItem
        const newLobby = {
            ...lobby,
            players: lobby.players.filter(
                (player) => player.socketId !== socketId
            ),
        }
        client.set(lobbyNumber, JSON.stringify(newLobby), {
            EX: lobbyExpirationTime,
        })
        return newLobby
    } else {
        throw new Error('Lobby does not exist')
    }
}

const changePlayerState = (
    playerStatus: boolean,
    socketId: string,
    playerLobby: LobbyItem
): LobbyItem => {
    return {
        ...playerLobby,
        players: playerLobby.players.map((player) => {
            if (player.socketId === socketId) {
                return { ...player, ready: playerStatus }
            }
            return player
        }),
    }
}

const generateDuelGame = async (lobby: LobbyItem) => {
    const gameParams = JSON.parse(
        (await getGameHandler(null)) ?? ''
    ) as GameParams

    if (!lobby.game.gameParams) {
        lobby.game = {
            gameParams: { ...gameParams, currentLevel: 1 },
            gameOptions: lobby.game.gameOptions,
        }
    } else {
        lobby.game = {
            gameParams: {
                ...gameParams,
                currentLevel: lobby.game.gameParams.currentLevel + 1,
            },
            gameOptions: lobby.game.gameOptions,
        }
    }

    return lobby
}

const evaluateGame = (players: PlayerItem[], finalDistance: number) => {
    return players
        .map((player) => {
            if (Math.round(player.distance) === Math.round(finalDistance)) {
                return {
                    ...player,
                    score: player.score + Math.round(finalDistance),
                    finished: false,
                    ready: false,
                    lastLevelscore: Math.round(finalDistance),
                }
            }
            return {
                ...player,
                finished: false,
                ready: false,
                lastLevelscore: 0,
                lastLevelTime: 0,
            }
        })
        .sort((a, b) => b.score - a.score)
}
