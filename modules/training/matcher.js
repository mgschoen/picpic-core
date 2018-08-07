const math = require('mathjs')

const { arrayToObject } = require('../util')

let articleTermsDict = null
let imageTermsDict = null

function calculateStats (articleTerms, imageTerms, matchedTerms) {
    let matchPercentage = Math.round((matchedTerms.length / imageTerms.length) * 10000) / 100

    let termFrequencies = [], 
        firstOccurrences = [],
        posValues = { nouns: [], verbs: [], adjs: [], advs: [], rest: [] }
    for (let termItem of articleTerms) {
        termFrequencies.push(termItem.termFrequency)
        firstOccurrences.push(termItem.firstOccurrence)
        posValues.nouns.push(termItem.pos.nouns.length)
        posValues.verbs.push(termItem.pos.verbs.length)
        posValues.adjs.push(termItem.pos.adjectives.length)
        posValues.advs.push(termItem.pos.adverbs.length)
        posValues.rest.push(termItem.pos.rest.length)
    }

    let posStats = {}
    for (let pos in posValues) {
        posStats[pos] = {
            mean: math.mean(posValues[pos]),
            median: math.median(posValues[pos]),
            std: math.std(posValues[pos])
        }
    }

    return {
        termsTotal: articleTerms.length,
        keywordsTotal: imageTerms.length,
        matchesTotal: matchedTerms.length,
        matchPercentage: matchPercentage,
        termFrequency: {
            max: Math.max(...termFrequencies),
            mean: math.mean(termFrequencies),
            median: math.median(termFrequencies),
            std: math.std(termFrequencies)
        },
        firstOccurrence: {
            mean: math.mean(firstOccurrences),
            median: math.median(firstOccurrences),
            std: math.std(firstOccurrences)
        },
        pos: posStats
    }
}

const Matcher = function (articleTerms, imageTerms) {
    this.articleTerms = articleTerms
    articleTermsDict = arrayToObject(articleTerms, 'stemmedTerm')
    this.imageTerms = imageTerms
    imageTermsDict = arrayToObject(imageTerms, 'stemmedText')
    this.matchedTerms = null
    this.stats = null
}

Matcher.prototype.match = function () {
    let matches = []
    for (let kw of this.imageTerms) {
        let possibleMatch = articleTermsDict[kw.stemmedText]
        if (possibleMatch) {
            possibleMatch.stemmedText = kw.stemmedText
            possibleMatch.originalTermsKW = kw.originalTerms
            possibleMatch.keywordType = kw.type
            matches.push(possibleMatch)
        }
    }
    this.matchedTerms = matches
    this.stats = calculateStats(this.articleTerms, this.imageTerms, this.matchedTerms)
}

Matcher.prototype.getNonKeywordTerms = function () {
    return this.articleTerms.filter(term => !imageTermsDict.hasOwnProperty(term.stemmedTerm))
}

Matcher.prototype.getKeywordTerms = function () {
    return this.articleTerms.filter(term => imageTermsDict.hasOwnProperty(term.stemmedTerm))
}

module.exports = Matcher