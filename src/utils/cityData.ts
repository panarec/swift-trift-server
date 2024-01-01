import citiesIds from './cities.json' assert { type: 'json' }
import _ from 'lodash'

export const getRandomCity = async () => {
    return citiesIds[_.random(0, citiesIds.length - 1)]
}
