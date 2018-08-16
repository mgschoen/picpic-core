const SVM = require('libsvm-js/asm')
const brain = require('brain.js')

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
    // let trainingFeatures = features.slice(0,1000)
    // let trainingLabels = labels.slice(0,1000)
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
    let trainingFeatures = [...keywordFeatures, ...regularTermsFeatures]
    let trainingLabels = [...keywordLabels, ...regularTermsLabels]
    console.log(`Training FastForwardNN model with ${trainingFeatures.length} terms ...`)
    console.log(`Training set includes ${trainingLabels.filter(l => l === 1).length} keywords`)
    let trainingData = trainingFeatures.map((featureSet, index) => {
        return { 
            input: featureSet, 
            output: { 
                keyword: trainingLabels[index],
                notKeyword: 1 - trainingLabels[index]
            }
        }
    })
    let trainingStats = this.model.train(trainingData)
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

module.exports = FastForwardNNClassifier