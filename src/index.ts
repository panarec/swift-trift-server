import express from 'express'
import { getGameHandler } from './handlers/getGameHandler'
import cors from 'cors'
import { moveHandler } from './handlers/moveHandler'
import { finnishGameHandler } from './handlers/finnishGameHandler'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { origin } from 'bun'
import { get } from 'lodash'

const corsOptions = {
    origin: 'http://localhost:5173',
}

const app = express()
const port = 3000

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
    cors: { origin: ['http://localhost:5173'] },
})

let rooms: RoomItem[] = []

type RoomItem = {
    lobbyNumber: string
    players: {
        playerName: string
        socketId: string
        ready: boolean
        score: number
    }[]
}

io.on('connection', (socket) => {
    console.log(socket.id)
    socket.broadcast.emit('random')
    socket.on('join-lobby', async (lobbyNumber, playerName, callback) => {
        await socket.join(lobbyNumber)
        const roomPlayers = io.sockets.adapter.rooms.get(lobbyNumber)
        console.log(roomPlayers)
        rooms = addPlayerToLobby(lobbyNumber, playerName, socket.id)

        const socketRoom = rooms.find(
            (room) => room.lobbyNumber === lobbyNumber
        )
        console.log(socketRoom)
        socket.to(lobbyNumber).emit('lobby-change', socketRoom)
        callback(socketRoom)
    })
    socket.on('leave-lobby', async (lobbyNumber, callback) => {
        await socket.leave(lobbyNumber)

        rooms = removePlayerFromLobby(lobbyNumber, socket.id)

        const socketRoom = rooms.find(
            (room) => room.lobbyNumber === lobbyNumber
        )
        callback()
        socket.to(lobbyNumber).emit('lobby-change', socketRoom)
    })
    socket.on('game-ready', async (playerStatus, callback) => {
        const playersRoom = rooms.find((room) => {
            return room.players.find((player) => player.socketId === socket.id)
        })

        if (playersRoom) {
            const socketRoom = rooms.find(
                (room) => room.lobbyNumber === playersRoom.lobbyNumber
            )

            rooms = changePlayerState(playerStatus, socket.id)

            const room = rooms.find(
                (room) => room.lobbyNumber === playersRoom.lobbyNumber
            )

            callback(room as RoomItem)
            if (room?.players.every((player) => player.ready)) {
                const gameParams = await getGameHandler(null)
                socket
                    .to(playersRoom.lobbyNumber)
                    .emit('lobby-change', room as RoomItem)
                socket
                    .to(playersRoom.lobbyNumber)
                    .emit('game-start', gameParams)
                socket.emit('game-start', gameParams)
            } else {
                socket
                    .to(playersRoom.lobbyNumber)
                    .emit('lobby-change', room as RoomItem)
            }
        } else {
            callback()
        }
    })
    socket.on('game-unready', async (lobbyNumber, callback) => {
        await socket.leave(lobbyNumber)
        console.log(lobbyNumber)
        const roomPlayers = io.sockets.adapter.rooms.get(lobbyNumber)

        rooms = removePlayerFromLobby(lobbyNumber, socket.id)

        const socketRoom = rooms.find(
            (room) => room.lobbyNumber === lobbyNumber
        )
        callback()
        socket.to(lobbyNumber).emit('player-left', socketRoom)
    })
})

httpServer.listen(3001)

const addPlayerToLobby = (
    lobbyNumber: string,
    playerName: string,
    socketId: string
): RoomItem[] => {
    const existingRoom = rooms.find((room) => room.lobbyNumber === lobbyNumber)
    if (existingRoom) {
        return rooms.map((room) => {
            if (room.lobbyNumber === lobbyNumber) {
                return {
                    lobbyNumber,
                    players: [
                        ...room.players,
                        { playerName, socketId, ready: false, score: 0 },
                    ],
                }
            }
            return room
        })
    }
    return [
        ...rooms,
        {
            lobbyNumber,
            players: [{ playerName, socketId, ready: false, score: 0 }],
        },
    ]
}

const removePlayerFromLobby = (lobbyNumber: string, socketId: string) => {
    return rooms.map((room) => {
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

const changePlayerState = (ready: boolean, socketId: string) => {
    return rooms.map((room) => {
        return {
            ...room,
            players: room.players.map((player) => {
                if (player.socketId === socketId) {
                    return { ...player, ready }
                }
                return player
            }),
        }
    })
}
