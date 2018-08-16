const Minimist = require('minimist')
const LineReader = require('n-readlines')
const fs = require('fs')

const SVMClassifier = require('../modules/search-term-extraction/svm-classifier')
const FFNNClassifier = require('../modules/search-term-extraction/ffnn-classifier')
const Benchmark = require('../modules/training/benchmark')
const { terminate } = require('./script-util')
const { getNextNLines } = require('../modules/util')
const { selectTrainingData } = require('../modules/search-term-extraction/training-data-util')

const APP_ROOT = require('app-root-path')
const OUTPUT_PATH_DEFAULT = APP_ROOT + '/data/'
const VALID_MODEL_TYPES = [ 'svm', 'ffnn' ]
const VALID_SELECTION_TYPES = [ 'slice', 'balanced', 'all' ]

const USAGE_STRING = `
yarn run train || npm run train
    -h, --help              display this help
    -m, --model             ffnn, svm, ...
    -t, --training-data     location of the training data file
    -s, --selection-type    how to select a subset of the training data, 
                            one of: slice, balanced, all (default: slice)
    -n, --num-datasets      maximum number of datasets to use for training,
                            default: 1000 (ignored when --selection-type 
                            is "all")
    -o, --output            where to store the trained model
`

// Read command line arguments
let argv = Minimist(process.argv.slice(2))
if (argv['h'] || argv['help']) {
    terminate(USAGE_STRING, 0)
}

let trainingDataPath = argv['t'] || argv['training-data']
let modelType = argv['m'] || argv['model'] || 'svm'
let outputPath = argv['o'] || argv['output'] || OUTPUT_PATH_DEFAULT
let selectionType = argv['s'] || argv['selection-type'] || 'slice'
let numDatasets = argv['n'] || argv['num-datasets'] || 1000
if (!trainingDataPath) {
    console.log(USAGE_STRING)
    terminate('No path to training data specified', 9)
}
if (VALID_MODEL_TYPES.indexOf(modelType) < 0) {
    terminate(`Model type ${modelType} is not valid`, 9)
}
if (outputPath[outputPath.length-1] !== '/') {
    outputPath += '/'
}
if (VALID_SELECTION_TYPES.indexOf(selectionType) < 0) {
    terminate(`Selection type ${selectionType} is not valid`, 9)
}

// Initialize classifier
let classifier
switch (modelType) {
    case 'svm':
        classifier = new SVMClassifier()
        break
    case 'ffnn':
        classifier = new FFNNClassifier()
        break
    default:
        terminate(`Unknown model type '${modelType}'`, 1)
}

// Train the model
console.log(`Reading training data from ${trainingDataPath} ...`)
let lineReaderTraining = new LineReader(trainingDataPath),
    linesTotal = 0,
    block = null,
    features = [],
    labels = []
while (block = getNextNLines(lineReaderTraining, 500)) {
    linesTotal += block.numLines
    features = features.concat(block.features)
    labels = labels.concat(block.labels)
}
console.log(`Read ${linesTotal} lines`)
let { trainingFeatures, trainingLabels } = selectTrainingData(features, labels, selectionType, { slices: numDatasets })
classifier.train(trainingFeatures, trainingLabels)

// Evaluate training
let trainingDataPathComponents = trainingDataPath.split('training.')
let testDataPath = `${trainingDataPathComponents[0]}test.${trainingDataPathComponents[1]}`
let benchmark = new Benchmark(classifier, testDataPath)
benchmark.loadTestData()
benchmark.run()

// Save the serialized trained model
let serializedModel = classifier.serialize()
let outputFileName = `${modelType}.${new Date().getTime()}.model`
console.log(`Storing model at ${outputPath}${outputFileName} ...`)
fs.writeFileSync(outputPath + outputFileName, serializedModel)
console.log('Done.')
console.log()
