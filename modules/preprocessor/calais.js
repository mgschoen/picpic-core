const CalaisEntity = require('./calais-entity')

const { arrayToObject, objectToArray } = require('../util')

function flattenCalaisObject (calaisObject) {
    if (Array.isArray(calaisObject)) {
        return calaisObject
    }
    let flatArray = []
    for (let key in calaisObject) {
        flatArray = [...flatArray, ...flattenCalaisObject(calaisObject[key])]
    }
    return flatArray
}

async function calaisAggregator (articleTermsObject, calaisTerms, fullText) {
    let articleTerms = objectToArray(articleTermsObject, 'stemmedTerm')
    let flatCalaisTerms = flattenCalaisObject(calaisTerms.entities)
    let calaisEntities = []
    let remainingTerms = []
    let aggregatedTerms = []
    for (let calaisTerm of flatCalaisTerms) {
        calaisEntities.push(new CalaisEntity(calaisTerm))
    }
    for (let term of articleTerms) {
        let merged = false
        for (let entity of calaisEntities) {
            if (entity.isInstance(term)) {
                entity.merge(term)
                merged = true
            } else if (entity.overlapsWith(term)) {
                merged = true
            }
        }
        if (!merged) {
            remainingTerms.push(term)
        }
    }
    for (let entity of calaisEntities) {
        aggregatedTerms.push(await entity.getTermObject(fullText))
    }
    return arrayToObject([...aggregatedTerms, ...remainingTerms], 'stemmedTerm')
}

module.exports = {
    calaisAggregator
}