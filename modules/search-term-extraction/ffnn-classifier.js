const SVM = require('libsvm-js/asm')
const brain = require('brain.js')

let preprocessTrainingData = function (features, labels, type, options) {
    let trainingFeatures, trainingLabels
    switch (type) {
        case 'slice':
            let n = options.slices || 1000
            trainingFeatures = features.slice(0, n)
            trainingLabels = labels.slice(0,n)
            break
        case 'balanced':
        default:
            let keywordIndices = [],
                keywordFeatures = [],
                keywordLabels = [],
                regularTermsLabels = []
            labels.forEach((label,idx) => {
                if (label === 1) keywordIndices.push(idx)
            })
            for (let index of keywordIndices) {
                keywordFeatures.push(features.splice(index, 1))
                keywordLabels.push(1)
                regularTermsLabels.push(0)
            }
            let regularTermsFeatures = features.slice(0, keywordFeatures.length)
            trainingFeatures = [...keywordFeatures, ...regularTermsFeatures]
            trainingLabels = [...keywordLabels, ...regularTermsLabels]
    }
    return trainingFeatures.map((featureSet, index) => {
        return { 
            input: featureSet, 
            output: { 
                keyword: trainingLabels[index],
                notKeyword: 1 - trainingLabels[index]
            }
        }
    })
}

let FastForwardNNClassifier = function () {
    this.model = new brain.NeuralNetwork()
    this.threshold = 0.05
}

FastForwardNNClassifier.prototype.train = function (features, labels) {
    if (features.length !== labels.length) {
        throw new Error('Error training SVM model. Features and labels must have the same lenght.')
    }
    const executionTimerLabel = 'Done training after'
    console.time(executionTimerLabel)
    let trainingData = preprocessTrainingData(features, labels, 'slice', { slices: 1000 })
    console.log(`Training FastForwardNN model with ${trainingData.length} terms ...`)
    console.log(`Training set includes ${trainingData.filter(d => d.output.keyword === 1).length} keywords`)
    let trainingStats = this.model.train(trainingData, {log: true})
    console.timeEnd(executionTimerLabel)
    console.log(JSON.stringify(trainingStats, undefined, 2))
}

FastForwardNNClassifier.prototype.predict = function (features) {
    console.log(`Predicting labels for ${features.length} terms`)
    let predictions = []
    for (let feature of features) {
        predictions.push(this.model.run(feature))
    }
    let aboveThreshold = predictions.map(p => {
        return (p.keyword >= this.threshold) ? 1 : 0
    })
    let predictedLabels = predictions.map(p => {
        return (p.keyword >= p.notKeyword) ? 1 : 0
    })
    return aboveThreshold
}

FastForwardNNClassifier.prototype.serialize = function () {
    return JSON.stringify(this.model.toJSON())
}

module.exports = FastForwardNNClassifier