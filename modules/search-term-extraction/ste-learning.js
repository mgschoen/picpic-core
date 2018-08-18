const fs = require('fs')

const SearchTermExtractor = require('./search-term-extractor')
const SVMClassifier = require('./svm-classifier')
const FFNNClassifier = require('./ffnn-classifier')

const { countArrayElements } = require('../util')

class LearningSearchTermExtractor extends SearchTermExtractor {

    constructor (modelType, modelPath, stemmedUniqueTerms, keywordThreshold) {
        super(stemmedUniqueTerms, keywordThreshold)
        // Load model
        switch (modelType) {
            case 'ffnn':
                this.model = new FFNNClassifier()
                break
            default:
                console.log(`${modelType} is not a valid model type. Falling back to 'svm'`)
            case 'svm':
                this.model = new SVMClassifier()
        }
        let modelString = fs.readFileSync(modelPath).toString()
        if (!this.model.loadFromString(modelString)) {
            throw new Error(`Error loading model from file ${modelPath}. Did you specify the correct model type?`)
        }
    }

    calculateProbabilities () {
        let predictionData = this.filteredTerms.map(term => {
            let countPtypes = countArrayElements(term.containingElements)
            let numH1 = countPtypes.H1 || 0
            let numH2 = countPtypes.H2 || 0
            let numP = countPtypes.P || 0
            let numLI = countPtypes.LI || 0
            let numOther = term.containingElements.length - numH1 - numH2 - numP - numLI
            let pos = term.pos
            return [
                term.termFrequency,
                term.firstOccurrence,
                numH1,
                numH2,
                numP,
                numLI,
                numOther,
                pos.nouns.length,
                pos.verbs.length,
                pos.adjectives.length,
                pos.adverbs.length,
                pos.rest.length
            ]
        })
        let predictions = this.model.predict(predictionData)
        let termsWithProbabilities = predictions.map((p, index) => {
            let entry = {...this.filteredTerms[index]}
            entry.p = p
            return entry
        })
        return termsWithProbabilities.sort((a, b) => b.p - a.p)
    }
}

module.exports = LearningSearchTermExtractor