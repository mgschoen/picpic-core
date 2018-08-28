const math = require('mathjs')
const Fuzzy = require('fuzzyset.js')
const Loki = require('lokijs')

const EXCLUDED_KEYWORD_TYPES = ['Age', 'Color', 'Composition', 'Gender', 
    'ImageTechnique', 'NumberOfPeople', 'Viewpoint']

let articleTermsLookup = null

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
    this.localDB = new Loki('matcher.js')
    
    this.articleTerms = this.localDB.addCollection('articleTerms')
    this.articleTerms.insert(articleTerms)
    
    this.imageTerms = this.localDB.addCollection('imageTerms')
    this.imageTerms.insert(imageTerms)

    articleTermsLookup = Fuzzy(articleTerms.map(term => term.stemmedTerm))

    this.matchedTerms = this.localDB.addCollection('matchedTerms')
    this.stats = null
}

Matcher.prototype.match = function () {
    let matches = []
    let imageTerms = this.imageTerms.find()
    for (let kw of imageTerms) {
        if (EXCLUDED_KEYWORD_TYPES.indexOf(kw.type) >= 0) {
            continue
        }
        let lookupTerms = articleTermsLookup.get(kw.stemmedText)
        let bestMatch = lookupTerms ? lookupTerms[0] : null
        let possibleMatch = (bestMatch && bestMatch[0] >= 0.75) 
            ? this.articleTerms.findOne({stemmedTerm: bestMatch[1]})
            : null
        if (possibleMatch && !possibleMatch.isKeyword) {
            possibleMatch.isKeyword = true
            possibleMatch.originalTermsKW = [...kw.originalTerms]
            possibleMatch.keywordType = [kw.type]
            let match = {...possibleMatch}
            delete match.$loki
            delete match.meta
            this.matchedTerms.insert(match)
        } else if (possibleMatch) {
            let match = this.matchedTerms.findOne({stemmedTerm: possibleMatch.stemmedTerm})
            match.originalTermsKW = [...match.originalTermsKW, ...kw.originalTerms]
            if (!match.keywordType.includes(kw.type)) {
                match.keywordType.push(kw.type)
            }
        }
    }
    this.stats = calculateStats(this.articleTerms.find(), this.imageTerms.find(), this.matchedTerms.find())
}

Matcher.prototype.getNonKeywordTerms = function () {
    return this.articleTerms.find({isKeyword: {$ne: true}})
}

Matcher.prototype.getKeywordTerms = function () {
    return this.articleTerms.find({isKeyword: true})
}

module.exports = Matcher