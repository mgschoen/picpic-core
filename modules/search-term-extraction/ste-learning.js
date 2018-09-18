const fs = require('fs')

const SearchTermExtractor = require('./search-term-extractor')
const SVMClassifier = require('./svm-classifier')
const FFNNClassifier = require('./ffnn-classifier')

const { countArrayElements } = require('../util')
const { getCalaisVector, scaledSigmoid } = require('./training-data-util')

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

    // Allowed values (and implicit order) for fields:
    // tf, fo, ptype, pos, calais-entity
    calculateProbabilities (features, normalize) {
        let predictionData = this.filteredTerms.map(term => {
            let countPtypes = countArrayElements(term.containingElements)
            let numH1 = countPtypes.H1 || 0
            let numH2 = countPtypes.H2 || 0
            let numP = countPtypes.P || 0
            let numLI = countPtypes.LI || 0
            let numOther = term.containingElements.length - numH1 - numH2 - numP - numLI
            let pos = term.pos
            let vector = []
            if (features.indexOf('tf') >= 0) {
                vector.push(normalize ? scaledSigmoid(term.termFrequency) : term.termFrequency)
            }
            if (features.indexOf('fo') >= 0) {
                vector.push(normalize ? scaledSigmoid(term.firstOccurrence) : term.firstOccurrence)
            }
            if (features.indexOf('ptype') >= 0) {
                vector = [
                    ...vector,
                    numH1 ? 1 : 0,
                    numH2 ? 1 : 0,
                    numP ? 1 : 0,
                    numLI ? 1 : 0,
                    numOther ? 1 : 0
                ]
            }
            if (features.indexOf('pos') >= 0) {
                vector = [
                    ...vector,
                    pos.nouns.length ? 1 : 0,
                    pos.verbs.length ? 1 : 0,
                    pos.adjectives.length ? 1 : 0,
                    pos.adverbs.length ? 1 : 0,
                    pos.rest.length ? 1 : 0
                ]
            }
            if (features.indexOf('calais-entity') >= 0) {
                vector = [
                    ...vector,
                    ...getCalaisVector(term)
                ]
            }
            return vector
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