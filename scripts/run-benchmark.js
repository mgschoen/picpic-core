const fs = require('fs')
const Minimist = require('minimist')

const SVMClassifier = require('../modules/search-term-extraction/svm-classifier')
const FastForwardNNClassifier = require('../modules/search-term-extraction/ffnn-classifier')
const Benchmark = require('../modules/training/benchmark')

const { terminate } = require('./script-util')

const USAGE_STRING = `
Usage of this script:

yarn run benchmark || npm run benchmark
    -f, --model-file         (location of the trained .model file)
    -m, --model-type         (type of the trained model: svm, ffnn, ...)
    -d, --testdata-path      (path to testdata .csv)
`

// Read command line arguments
let argv = Minimist(process.argv.slice(2))
let modelPath = argv['f'] || argv['model-file']
let modelType = argv['m'] || argv['model-type'] || 'svm'
let testDataPath = argv['d'] || argv['testdata-path']
if (!modelPath || !testDataPath) {
    terminate('Please specify a --model-file (-f) and a --testdata-path (-d)\n' + USAGE_STRING, 1)
}

let classifier
switch (modelType) {
    case 'ffnn':
        classifier = new FastForwardNNClassifier()
        break
    case 'svm':
    default:
        classifier = new SVMClassifier()
}

let modelString = fs.readFileSync(modelPath).toString()
if (!classifier.loadFromString(modelString)) {
    terminate(`Error loading model from file ${modelPath}. Did you specify the correct model type?`)
}

let benchmark = new Benchmark(classifier, testDataPath)
benchmark.loadTestData()
benchmark.run()
