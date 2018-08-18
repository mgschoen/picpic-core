const SearchTermExtractor = require('./search-term-extractor')

class StatisticalSearchTermExtractor extends SearchTermExtractor {

    constructor (stemmedUniqueTerms, keywordThreshold) {
        super(stemmedUniqueTerms, keywordThreshold)
        this.maxTermFrequency = null
    }

    calculateProbabilities () {
        this.maxTermFrequency = Math.max(...this.filteredTerms.map(term => term.termFrequency))
        return this.filteredTerms.map(term => {
            return {
                stemmedTerm: term.stemmedTerm,
                originalTerms: term.originalTerms,
                p: (term.termFrequency / this.maxTermFrequency) * (1 - term.firstOccurrence)
            }
        }).sort((a, b) => b.p - a.p)
    }

}

module.exports = StatisticalSearchTermExtractor