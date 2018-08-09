const { concatStrings, isStopword, objectToArray } = require('../util')

let termsDictionary = null

function getTermsWithThreshold (terms, threshold, above) {
    let filterFunction = above 
        ? (term => term.p > threshold) 
        : (term => term.p <= threshold)
    return terms
        .filter(filterFunction)
        .map(term => {
            let dictEntry = {...termsDictionary[term.stemmedTerm]}
            dictEntry.p = term.p
            dictEntry.stemmedTerm = term.stemmedTerm
            return dictEntry
        })
}

function largestParent (arrayOfStrings, string, includeIdentical) {

    let compareFunction = (arrayItem, searchItem) => {
        return (includeIdentical ? true : arrayItem !== searchItem) && 
            (arrayItem.indexOf(searchItem) >= 0)
    }

    let parent = null
    let parentLength = 0
    let parentIndex = -1
    for (let i in arrayOfStrings) {
        let arrayItem = arrayOfStrings[i]
        let arrayItemLength = arrayItem.split(' ').length
        if (compareFunction(arrayItem, string) &&
            arrayItemLength > parentLength) {
                parent = arrayItem
                parentLength = arrayItemLength
                parentIndex = i
        }
    }
    return parent ? { value: parent, index: parentIndex } : null
}

/**
 * Applies a selection heuristic to generate a query out of a list of terms 
 * and their associated probabilites of being a search term.
 * 
 * 1. Terms with a probability above the specified threshold are considered to be
 * appropriate search terms.
 * 2. Of all appropriate terms, the first two are selected.
 * 3. If any of the selected terms is a subterm of another appropriate term, it
 * is replaced by the longest appropriate superterm.
 * 4. If both selected terms can be integrated in the same superterm, the next 
 * best appropriate term is considered, and so on...
 * 5. If the combination of the selected terms contains more than 3 words, 
 * discard the shorter term.
 * 6. Return the selected term(s) concatenated.
 * 
 * @param {object[]} probabilities list of terms and their associated probabilities of being
 *                              a search term. Format: { stemmedTerm: String, p: Number }
 * @param {number} threshold minimum probability for terms to be considered
 */
function generateSearchRequest (probabilities, threshold) {
    // 1. Get appropriate terms
    let keywords = getTermsWithThreshold(probabilities, threshold, true)
    let mergedKeywords = []

    // 3. + 4. Discard all subterms and put all superterms at the position of their first subterm
    for (let i = 0; i < keywords.length; i++) {
        let current = keywords[i]
        let { stemmedTerm } = current
        // iterate over remaining terms in search for parents
        let searchForParent = largestParent(keywords.map(kw => kw.stemmedTerm), stemmedTerm, false)
        let parent = searchForParent ? keywords[searchForParent.index] : null
        // iterate over mergedKeywords in search for parents
        let candidate = parent ? parent : current
        let searchForMergedParent = largestParent(
            mergedKeywords.map(kw => kw.stemmedTerm), 
            candidate.stemmedTerm, 
            true)
        if (!searchForMergedParent) {
            mergedKeywords.push(candidate)
        }
    }

    // 2. Select the two query terms
    let requestKeywords = mergedKeywords.slice(0, 2)
    let keywordsString = concatStrings(requestKeywords.map(kw => kw.originalTerms[0]), ' ')
    let requestString = keywordsString
    // 5. Shorten the query if neccessary
    if (keywordsString.split(' ').length > 3) {
        let firstLength = requestKeywords[0] ? requestKeywords[0].originalTerms[0].split(' ').length : 0
        let secondLength = requestKeywords[1] ? requestKeywords[1].originalTerms[0].split(' ').length : 0
        let diff = firstLength - secondLength
        if (diff < 0) {
            requestString = requestKeywords[1].originalTerms[0]
        } else if (diff > 0 || (diff == 0 && requestKeywords[0])) {
            requestString = requestKeywords[0].originalTerms[0]
        }
    }
    // 6. Phew.
    return requestString.toLowerCase()
}

function calculateProbabilities (terms, maxTermFrequency) {
    return terms.map(term => {
        return {
            stemmedTerm: term.stemmedTerm,
            originalTerms: term.originalTerms,
            p: (term.termFrequency / maxTermFrequency) * (1 - term.firstOccurrence)
        }
    }).sort((a, b) => b.p - a.p)
}

function filterStopwords (terms) {
    return terms.filter(term => {
        if (isStopword(term.stemmedTerm)) {
            return false
        }
        for (let originalTerm of term.originalTerms) {
            if (isStopword(originalTerm)) {
                return false
            }
        }
        return true
    })
}

function StatisticalSearchTermExtractor (stemmedUniqueTerms, keywordThreshold) {
    termsDictionary = stemmedUniqueTerms
    this.originalTerms = objectToArray(stemmedUniqueTerms, 'stemmedTerm')
    this.keywordThreshold = keywordThreshold
    this.filteredTerms = null
    this.maxTermFrequency = null
    this.maxTermFrequency = null
    this.termProbabilities = null
    this.query = null
}

StatisticalSearchTermExtractor.prototype.generateSearchTerm = function () {
    this.filteredTerms = filterStopwords(this.originalTerms)
    this.maxTermFrequency = Math.max(...this.filteredTerms.map(term => term.termFrequency))
    this.termProbabilities = calculateProbabilities(this.filteredTerms, this.maxTermFrequency)
    this.query = generateSearchRequest(this.termProbabilities, this.keywordThreshold)
    return this.query
}

StatisticalSearchTermExtractor.prototype.getKeywords = function () {
    return getTermsWithThreshold(this.termProbabilities, this.keywordThreshold, true)
}

StatisticalSearchTermExtractor.prototype.getNonKeywords = function () {
    return getTermsWithThreshold(this.termProbabilities, this.keywordThreshold, false)
}

module.exports = StatisticalSearchTermExtractor