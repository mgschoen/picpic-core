const math = require('mathjs')
const Fuzzy = require('fuzzyset.js')

const { arrayToObject } = require('../util')

const EXCLUDED_KEYWORD_TYPES = ['Age', 'Color', 'Composition', 'Gender', 
    'ImageTechnique', 'NumberOfPeople', 'Viewpoint']

let articleTermsDict = null
let articleTermsLookup = null
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
    articleTermsLookup = Fuzzy(articleTerms.map(term => term.stemmedTerm))
    this.imageTerms = imageTerms
    imageTermsDict = arrayToObject(imageTerms, 'stemmedText')
    this.matchedTerms = null
    this.stats = null
}

Matcher.prototype.match = function () {
    let matches = []
    for (let kw of this.imageTerms) {
        if (EXCLUDED_KEYWORD_TYPES.indexOf(kw.type) >= 0) {
            continue
        }
        let lookupTerms = articleTermsLookup.get(kw.stemmedText)
        let bestMatch = lookupTerms ? lookupTerms[0] : null
        let possibleMatch = (bestMatch && bestMatch[0] >= 0.75) 
            ? articleTermsDict[bestMatch[1]]
            : null
        if (possibleMatch && !possibleMatch.isKeyword) {
            possibleMatch.isKeyword = true
            possibleMatch.stemmedText = bestMatch[1]
            possibleMatch.originalTermsKW = [...kw.originalTerms]
            possibleMatch.keywordType = [kw.type]
            matches.push(possibleMatch)
        } else if (possibleMatch) {
            let match = matches.filter(match => match.stemmedText === possibleMatch.stemmedText)[0]
            match.originalTermsKW = [...match.originalTermsKW, ...kw.originalTerms]
            if (!match.keywordType.includes(kw.type)) {
                match.keywordType.push(kw.type)
            }
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