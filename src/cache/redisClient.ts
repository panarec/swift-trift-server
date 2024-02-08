import { createClient } from 'redis'

export const client = createClient({
    url: process.env.REDIS_URL,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    name: process.env.REDIS_NAME,
})

client.on('error', (err) => console.log('Redis Client Error', err))

await client.connect()
