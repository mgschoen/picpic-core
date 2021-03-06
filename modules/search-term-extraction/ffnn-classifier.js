const brain = require('brain.js')
const ProgressBar = require('node-progress-bars')

let preprocessTrainingData = function (features, labels) {
    return features.map((featureSet, index) => {
        return { 
            input: featureSet, 
            output: { 
                keyword: labels[index],
                notKeyword: 1 - labels[index]
            }
        }
    })
}

function updateProgressBars (iterationsBar, errorBar, logString) {
    let fields = logString.split(', ')
    let log = {}
    for (let field of fields) {
        let keyValue = field.split(': ')
        log[keyValue[0]] = parseFloat(keyValue[1]) || keyValue[1]
    }
    iterationsBar.update(log['iterations'] / 20000, {exactValue: log['iterations']})
    errorBar.update(0, {exactValue: log['training error']})
}

let FastForwardNNClassifier = function () {
    this.model = new brain.NeuralNetwork()
    this.errorThreshold = 0.005
}

FastForwardNNClassifier.prototype.train = function (features, labels) {
    if (features.length !== labels.length) {
        throw new Error('Error training SVM model. Features and labels must have the same lenght.')
    }
    // Start timer
    const executionTimerLabel = 'Done training after'
    console.time(executionTimerLabel)

    // Format training data
    let trainingData = preprocessTrainingData(features, labels, 'slice', { slices: 1000 })

    // Some loggings
    console.log(`Training FastForwardNN model with ${trainingData.length} terms ...`)
    console.log(`Training set includes ${trainingData.filter(d => d.output.keyword === 1).length} keywords`)
    console.log()
    console.log(`Error threshold: ${this.errorThreshold}`)
    let progressIterations = new ProgressBar({
        schema: '     Iterations: [:bar] :exactValue :elapseds',
        total: 20000
    })
    let progressError = new ProgressBar({
        schema: ' Training error: :exactValue',
        total: 1000
    })

    // Start training
    this.model.train(trainingData, {
        log: logString => { updateProgressBars(progressIterations, progressError, logString) },
        errorThresh: this.errorThreshold
    })

    // Clear progress bars
    progressError.clear()
    progressIterations.clear()

    console.log()
    console.log()
    console.timeEnd(executionTimerLabel)
}

FastForwardNNClassifier.prototype.predict = function (features) {
    console.log(`Predicting labels for ${features.length} terms`)
    let predictions = []
    for (let feature of features) {
        predictions.push(this.model.run(feature))
    }
    return predictions.map(p => p.keyword)
}

FastForwardNNClassifier.prototype.serialize = function () {
    return JSON.stringify(this.model.toJSON())
}

FastForwardNNClassifier.prototype.loadFromString = function (string) {
    try {
        let config = JSON.parse(string)
        this.model.fromJSON(config)
        console.log('FastForwardNN loaded succcessfully')
        return true
    } catch (error) {
        console.warn(`Failed to load FastForwardNN from string: ${error.message}`)
        return false
    }
} 

module.exports = FastForwardNNClassifier