// yarn run train -t ~/code/picpic-core/data/training.2018-8-15-14-3-45.csv -m SVM -o ./data/
// -t, --training-data      (where the training data comes from)
// -m, --model              (nb, svm, dt, ffnn, ...)
// -o, --output             (where to store the trained model)

// training-data-loader.js  (loads the CSV, processes it and returns the data)
// trainer.js               (gets passed a model instance and the training data, 
//                          handles training and storing)
// naive-bayes.js           (all implement the same set of methods for training,
// support-vector.js        serialization and deserialization of the model)
// decision-tree.js
// neural-net.js

// this script              merely a wrapper for all the stuff above

const Minimist = require('minimist')
const LineReader = require('n-readlines')
const fs = require('fs')

const SVMClassifier = require('../modules/search-term-extraction/svm-classifier')
const { terminate } = require('./script-util')

const APP_ROOT = require('app-root-path')
const OUTPUT_PATH_DEFAULT = APP_ROOT + '/data/'
const VALID_MODEL_TYPES = [ 'svm' ]

const USAGE_STRING = `
yarn run train || npm run train
    -t, --training-data      (location of the training data file)
    -m, --model              (nb, svm, dt, ffnn, ...)
    -o, --output             (where to store the trained model)
`

function getNextNLines (lineReader, n) {
    let numLines = 0,
        lineBuffer = null,
        features = [],
        labels = []
    while ((lineBuffer = lineReader.next()) && numLines < n) {
        let line = lineBuffer.toString('ascii')
        let values = line.split(',').slice(2).map(v => parseFloat(v))
        let label = values.pop()
        features.push(values)
        labels.push(label)
        numLines++
    }
    if (numLines === 0) {
        return null
    }
    return { numLines, features, labels }
}

// Read command line arguments
let argv = Minimist(process.argv.slice(2))
let trainingDataPath = argv['t'] || argv['training-data']
let modelType = argv['m'] || argv['model'] || 'svm'
let outputPath = argv['m'] || argv['output'] || OUTPUT_PATH_DEFAULT
if (!trainingDataPath) {
    console.log(USAGE_STRING)
    terminate('No path to training data specified', 9)
}
if (VALID_MODEL_TYPES.indexOf(modelType) < 0) {
    terminate(`Model type ${modelType} is not valid`, 9)
}

// Initialize classifier
let classifier
switch (modelType) {
    case 'svm':
        classifier = new SVMClassifier()
        break
    default:
        terminate(`Unknown model type '${modelType}'`, 1)
}

// Train the model
console.log(`Reading training data from ${trainingDataPath} ...`)
let lineReaderTraining = new LineReader(trainingDataPath),
    linesTotal = 0,
    block = null,
    trainingFeatures = [],
    trainingLabels = []
while (block = getNextNLines(lineReaderTraining, 500)) {
    linesTotal += block.numLines
    trainingFeatures = trainingFeatures.concat(block.features)
    trainingLabels = trainingLabels.concat(block.labels)
}
classifier.train(trainingFeatures, trainingLabels)
console.log(`Done training after reading ${linesTotal} lines`)


// Evaluate training
let trainingDataPathComponents = trainingDataPath.split('training.')
let testDataPath = `${trainingDataPathComponents[0]}test.${trainingDataPathComponents[1]}`
let lineReaderTest = new LineReader(testDataPath)
let predictions = []
let correctLabels = []
while (block = getNextNLines(lineReaderTest, 1500)) {
    correctLabels = [...correctLabels, ...block.labels]
    predictions = [...predictions, ...classifier.predict(block.features)]
}
let keywordsTotal = correctLabels.filter(l => l === 1).length
let regularTermsTotal = correctLabels.filter(l => l === 0).length
let keywordsCorrect = 0
let regularTermsCorrect = 0
predictions.forEach((p, i) => {
    let correct = correctLabels[i]
    if (correct === 0 && p === correct) {
        regularTermsCorrect++
    }
    if (correct === 1 && p === correct) {
        keywordsCorrect++
    }
})
let predictionsCorrect = predictions.filter((p, i) => {
    return p === correctLabels[i]
})
let predictionRate = predictionsCorrect.length / predictions.length

console.log()
console.log(`Rate of correct predictions: ${100 * predictionRate} %`)
console.log(`Correctly predicted regular terms: ${100 * regularTermsCorrect/regularTermsTotal} %` +
    ` (${regularTermsCorrect}/${regularTermsTotal})`)
console.log(`Correctly predicted keywords: ${100 * keywordsCorrect/keywordsTotal} %` +
    ` (${keywordsCorrect}/${keywordsTotal})`)
let predictedKeywords = predictions.filter(p => p === 1)
console.log(`Predicted keywords: ${predictedKeywords.length}`)
console.log()
