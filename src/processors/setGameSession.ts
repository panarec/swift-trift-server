import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb"; 
import redis from "redis"

export const setGameSession = async (userId, gameParams) => {
    redis.createClient()
    return {
        level: 1,
        startNode: null,
        finnishNode: null
    }
}