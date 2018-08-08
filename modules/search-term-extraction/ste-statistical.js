function filterStopwords (terms) {
    return terms
}

function StatisticalSearchTermExtractor (stemmedUniqueTerms) {
    this.originalTerms = stemmedUniqueTerms
    this.filteredTerms = null
    this.termProbabilities = null
    this.query = null
}

StatisticalSearchTermExtractor.prototype.generateSearchTerm = function () {
    this.filteredTerms = filterStopwords(this.originalTerms)
}

module.exports = StatisticalSearchTermExtractor