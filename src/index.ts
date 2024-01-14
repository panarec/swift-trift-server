import express from 'express'
import { getGameHandler } from './handlers/getGameHandler'
import cors from 'cors'
import { moveHandler } from './handlers/moveHandler'
import { finnishGameHandler } from './handlers/finnishGameHandler'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { GameParams } from './handlers/types'
import { v4 } from 'uuid'
import { getRouteCoordinates } from './services/mapbox/mapmatching/getRouteCoordinates'
import 'dotenv/config'
import logger from 'pino'

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

app.listen(port, () => {
    console.log(`Listening on port ${port}...`)
})

const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: { origin: [process.env.CLIENT_URL as string] },
})

let lobbies: LobbyItem[] = []

type PlayerItem = {
    playerName: string
    socketId: string
    ready: boolean
    score: number
    color: string
    finished: boolean
    routeCoordinates: number[][]
    distance: number
}

type LobbyItem = {
    lobbyNumber: string
    players: PlayerItem[]
    game: {
        gameParams: GameParams | null
        gameOptions: GameOptions
    }
}
type GameOptions = {
    timeLimit: number
    levelsPerGame: number
}

const availableColors = ['FF9F1C', '3772FF', 'DF2935', '43E726', 'CD38FF']

io.on('connection', (socket) => {
    console.log(socket.id)
    socket.on(
        'join-lobby',
        async (lobbyNumber: string, playerName: string, callback) => {
            log.info(`Player ${playerName} joined lobby ${lobbyNumber}`)
            await socket.join(lobbyNumber)
            lobbies = addPlayerToLobby(lobbyNumber, playerName, socket.id)

            const socketRoom = lobbies.find(
                (lobby) => lobby.lobbyNumber === lobbyNumber
            )
            log.info('Player joined lobby')
            log.info(
                `Lobby ${lobbyNumber} has ${socketRoom?.players.length} players`
            )
            socket.to(lobbyNumber).emit('lobby-change', socketRoom)
            callback(socketRoom)
        }
    )
    socket.on('leave-lobby', async (callback) => {
        const lobbyNumber = lobbies.find((lobby) => {
            return lobby.players.find((player) => player.socketId === socket.id)
        })?.lobbyNumber

        if (!lobbyNumber) return

        await socket.leave(lobbyNumber)

        lobbies = removePlayerFromLobby(lobbyNumber, socket.id)

        const socketLobby = lobbies.find(
            (lobby) => lobby.lobbyNumber === lobbyNumber
        )
        callback()
        socket.to(lobbyNumber).emit('lobby-change', socketLobby)
    })
    socket.on(
        'change-lobby-options',
        async (options: GameOptions, callback) => {
            const playerLobby = lobbies.find((lobby) => {
                return lobby.players.find(
                    (player) => player.socketId === socket.id
                )
            })
            if (playerLobby) {
                lobbies = lobbies.map((lobby) => {
                    if (lobby.lobbyNumber === playerLobby.lobbyNumber) {
                        return {
                            ...lobby,
                            options,
                        }
                    }
                    return lobby
                })
                socket.emit('lobby-change', playerLobby as LobbyItem)
                socket
                    .to(playerLobby.lobbyNumber)
                    .emit('lobby-change', playerLobby as LobbyItem)
            }
        }
    )
    socket.on(
        'game-ready',
        async (playerStatus: boolean, options: GameOptions, callback) => {
            const playerLobby = lobbies.find((lobby) => {
                return lobby.players.find(
                    (player) => player.socketId === socket.id
                )
            })

            if (playerLobby) {
                const newLobby = changePlayerState(
                    playerStatus,
                    socket.id,
                    playerLobby
                )

                lobbies = lobbies.map((lobby) => {
                    if (lobby.lobbyNumber === playerLobby.lobbyNumber) {
                        return newLobby
                    }
                    return lobby
                })

                socket.emit('lobby-change', newLobby as LobbyItem)
                socket
                    .to(playerLobby.lobbyNumber)
                    .emit('lobby-change', newLobby as LobbyItem)
                if (newLobby?.players.every((player) => player.ready)) {
                    socket.to(playerLobby.lobbyNumber).emit('all-ready')
                    socket.emit('all-ready')
                    const lobbyWithGame = await generateDuelGame(playerLobby)
                    lobbies = lobbies.map((lobby) => {
                        if (lobby.lobbyNumber === playerLobby.lobbyNumber) {
                            return lobbyWithGame
                        }
                        return lobby
                    })

                    socket
                        .to(playerLobby.lobbyNumber)
                        .emit('game-start', lobbyWithGame.game.gameParams)
                    socket.emit('game-start', lobbyWithGame.game.gameParams)
                }
            }
        }
    )

    socket.on('finnish-level', async (routeCoordinates) => {
        const playerLobby = lobbies.find((lobby) => {
            return lobby.players.find((player) => player.socketId === socket.id)
        })

        if (playerLobby) {
            const player = playerLobby.players.find(
                (player) => player.socketId === socket.id
            )
            if (player) {
                player.finished = true
                const playerMatchObject =
                    await getRouteCoordinates(routeCoordinates)
                player.distance = playerMatchObject.distance
                player.routeCoordinates = playerMatchObject.geometry.coordinates

                const players = playerLobby.players
                const finnishedPlayers = players.filter(
                    (player) => player.finished
                )
                if (finnishedPlayers.length === players.length) {
                    if (playerLobby.game.gameParams) {
                        const finalRoute = await getRouteCoordinates([
                            [
                                playerLobby.game.gameParams.startMarkerPosition
                                    .lng,
                                playerLobby.game.gameParams.startMarkerPosition
                                    .lat,
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

                        lobbies = lobbies.map((lobby) => {
                            if (lobby.lobbyNumber === playerLobby.lobbyNumber) {
                                return {
                                    ...lobby,
                                    players: evaluatedPlayers,
                                }
                            }
                            return lobby
                        })

                        const currentLobby = lobbies.find(
                            (lobby) =>
                                lobby.lobbyNumber === playerLobby.lobbyNumber
                        )

                        socket
                            .to(playerLobby.lobbyNumber)
                            .emit('game-finnished', {
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
        }
    })
})

httpServer.listen(process.env.SOCKET_PORT)

const defaultGameOptions = {
    timeLimit: 300,
    levelsPerGame: 3,
}

const addPlayerToLobby = (
    lobbyNumber: string,
    playerName: string,
    socketId: string
): LobbyItem[] => {
    const existingLobby = lobbies.find(
        (lobby) => lobby.lobbyNumber === lobbyNumber
    )
    if (existingLobby) {
        log.info(`${lobbyNumber} exists. Player ${playerName} joined.`)
        return lobbies.map((lobby) => {
            if (lobby.lobbyNumber === lobbyNumber) {
                return {
                    lobbyNumber,
                    game: {
                        gameParams: lobby.game.gameParams,
                        gameOptions: lobby.game.gameOptions,
                    },
                    players: [
                        ...lobby.players,
                        {
                            playerName,
                            socketId,
                            ready: false,
                            score: 0,
                            color: availableColors[lobby.players.length],
                            finished: false,
                            routeCoordinates: [],
                            distance: 0,
                        },
                    ],
                }
            }
            return lobby
        })
    }
    log.info(`${lobbyNumber} does not exist. Creating...`)
    return [
        ...lobbies,
        {
            lobbyNumber,
            game: {
                gameParams: null,
                gameOptions: defaultGameOptions,
            },
            players: [
                {
                    playerName,
                    socketId,
                    ready: false,
                    score: 0,
                    color: availableColors[0],
                    finished: false,
                    routeCoordinates: [],
                    distance: 0,
                },
            ],
        },
    ]
}

const removePlayerFromLobby = (lobbyNumber: string, socketId: string) => {
    return lobbies.map((room) => {
        if (room.lobbyNumber === lobbyNumber) {
            return {
                ...room,
                players: room.players.filter(
                    (player) => player.socketId !== socketId
                ),
            }
        }
        return room
    })
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

    lobby.game = {
        gameParams,
        gameOptions: lobby.game.gameOptions,
    }

    return lobby
}

const evaluateGame = (players: PlayerItem[], finalDistance: number) => {
    return players
        .map((player) => {
            if (player.distance === finalDistance) {
                return {
                    ...player,
                    score: player.score + Math.round(finalDistance),
                    finished: false,
                    ready: false,
                }
            }
            return { ...player, finished: false, ready: false }
        })
        .sort((a, b) => b.score - a.score)
}
