const { 
    arrayToObject,
    concatStrings,
    filterStopwords,
    tokenizePlainText 
} = require('../util')

/**
 * This class acts as an interface that provides the framework
 * for extracting search terms from a list of terms. To use it,
 * inherit from it and implement the `calculateProbabilites`
 * function that considers the list of `filteredTerms` and returns 
 * a sorted list of terms with the additional property `p` 
 * representing the probability of each term being a search term.
 */
class SearchTermExtractor {

    constructor (stemmedUniqueTerms, keywordThreshold) {
        this.termsDictionary = arrayToObject(stemmedUniqueTerms, 'stemmedTerm')
        this.originalTerms = stemmedUniqueTerms
        this.keywordThreshold = keywordThreshold
        this.filteredTerms = filterStopwords(this.originalTerms)
        this.termProbabilities = null
        this.query = null
    }

    static largestParent (arrayOfStrings, string, includeIdentical) {

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

    getTermsWithThreshold (above) {
        let filterFunction = above 
            ? (term => term.p > this.keywordThreshold) 
            : (term => term.p <= this.keywordThreshold)
        return this.termProbabilities
            .filter(filterFunction)
            .map(term => {
                let dictEntry = {...this.termsDictionary[term.stemmedTerm]}
                dictEntry.p = term.p
                dictEntry.stemmedTerm = term.stemmedTerm
                return dictEntry
            })
    }

    /**
     * Applies a selection heuristic to generate a query out of the list of 
     * `termProbabilites`.
     * 
     * 1. Terms with a probability above the specified `keywordThreshold` are considered 
     * to be appropriate search terms.
     * 2. Of all appropriate terms, the first two are selected.
     * 3. If any of the selected terms is a subterm of another appropriate term, it
     * is replaced by the longest appropriate superterm.
     * 4. If both selected terms can be integrated in the same superterm, the next 
     * best appropriate term is considered, and so on...
     * 5. If the combination of the selected terms contains more than 3 words, 
     * discard the shorter term.
     * 6. Return the selected term(s) concatenated.
     */
    generateQuery (ignoreSuperterms) {
        // 1. Get appropriate terms
        let keywords = this.getTermsWithThreshold(true)
        let mergedKeywords = []

        if (ignoreSuperterms) {
            mergedKeywords = keywords
        } else {
            // 3. + 4. Discard all subterms and put all superterms at the position of their first subterm
            for (let i = 0; i < keywords.length; i++) {
                let current = keywords[i]
                let { stemmedTerm } = current
                // iterate over remaining terms in search for parents
                let searchForParent = SearchTermExtractor.largestParent(keywords.map(kw => kw.stemmedTerm), stemmedTerm, false)
                let parent = searchForParent ? keywords[searchForParent.index] : null
                // iterate over mergedKeywords in search for parents
                let candidate = parent ? parent : current
                let searchForMergedParent = SearchTermExtractor.largestParent(
                    mergedKeywords.map(kw => kw.stemmedTerm), 
                    candidate.stemmedTerm, 
                    true)
                if (!searchForMergedParent) {
                    mergedKeywords.push(candidate)
                }
            }
        }

        // 2. Select the two query terms
        let requestKeywords = mergedKeywords.slice(0, 2)
        let requestTerms = requestKeywords.map(kw => (kw.canonicalTerm || kw.originalTerms[0]))
        let keywordsString = concatStrings(requestTerms, ' ')
        let requestString = keywordsString
        // 5. Shorten the query if neccessary
        if (keywordsString.split(' ').length > 3) {
            let firstLength = requestTerms[0] ? requestTerms[0].split(' ').length : 0
            let secondLength = requestTerms[1] ? requestTerms[1].split(' ').length : 0
            let diff = firstLength - secondLength
            if (diff < 0) {
                requestString = requestTerms[1]
            } else if (diff > 0 || (diff == 0 && requestTerms[0])) {
                requestString = requestTerms[0]
            }
        }
        // 6. Phew.
        return requestString.toLowerCase()
    }

    queryFromCalais () {
        let calaisTerms = this.getCalaisTerms()
        let firstTerm = calaisTerms[0].canonicalTerm
            || calaisTerms[0].originalTerms[0]
        let secondTerm = calaisTerms[1].canonicalTerm
            || calaisTerms[1].originalTerms[0]
        let query = firstTerm
        if (tokenizePlainText(firstTerm).length < 2 && 
            tokenizePlainText(secondTerm).length < 2) {
                query += ` ${secondTerm}`
        }
        return query.toLowerCase()
    }

    generateSearchTerm (calaisEntitiesOnly, featuresToConsider, normalize, ignoreSuperterms) {
        this.termProbabilities = this.calculateProbabilities(featuresToConsider, normalize)
        this.query = calaisEntitiesOnly ? this.queryFromCalais() : this.generateQuery(ignoreSuperterms)
        let consideredTerms = calaisEntitiesOnly 
            ? this.getCalaisTerms()
            : this.getKeywords()
        return {
            termSet: calaisEntitiesOnly ? 'calais' : 'all',
            query: this.query,
            consideredTerms
        }
    }

    getCalaisTerms () {
        return this.termProbabilities
            .filter(term => term.calaisEntityType)
            .sort((a, b) => b.p - a.p)
    }

    getKeywords () {
        return this.getTermsWithThreshold(true)
    }

    getNonKeywords () {
        return this.getTermsWithThreshold(false)
    }

}

module.exports = SearchTermExtractor