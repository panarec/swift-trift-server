import express from 'express'
import { getGameHandler } from './handlers/getGameHandler'
import cors from 'cors'
import { moveHandler } from './handlers/moveHandler'
import { finnishGameHandler } from './handlers/finnishGameHandler'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { origin } from 'bun'

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

type RoomItem = {
    lobbyNumber: string
    players: {
        playerName: string
        socketId: string
    }[]
}

let rooms: RoomItem[] = []

io.on('connection', (socket) => {
    console.log(socket.id)
    socket.broadcast.emit('random')
    socket.on('join-lobby', async (lobbyNumber, playerName, callback) => {
        await socket.join(lobbyNumber)
        const roomPlayers = io.sockets.adapter.rooms.get(lobbyNumber)

        rooms = addPlayerToLobby(lobbyNumber, playerName, socket.id)

        const socketRoom = rooms.find(
            (room) => room.lobbyNumber === lobbyNumber
        )

        socket.to(lobbyNumber).emit('player-joined', socketRoom)
        callback(socketRoom)
    })
    socket.on('leave-lobby', async (lobbyNumber, callback) => {
        await socket.leave(lobbyNumber)
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
) => {
    const existingRoom = rooms.find((room) => room.lobbyNumber === lobbyNumber)
    if (existingRoom) {
        return rooms.map((room) => {
            if (room.lobbyNumber === lobbyNumber) {
                return {
                    lobbyNumber,
                    players: [...room.players, { playerName, socketId }],
                }
            }
            return {
                lobbyNumber,
                players: [{ playerName, socketId }],
            }
        })
    }
    return [
        ...rooms,
        {
            lobbyNumber,
            players: [{ playerName, socketId }],
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
