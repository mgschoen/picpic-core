const LineReader = require('n-readlines')

const ValueList = require('../print/value-list')
const { getNextNLines, roundToDecimals } = require('../util')

let Benchmark = function (classifier, testDataPath, keywordThreshold) {
    this.classifier = classifier
    this.testDataPath = testDataPath
    this.keywordThreshold = (typeof keywordThreshold === 'number') ? keywordThreshold : 0.05
    this.testData = null
}

Benchmark.prototype.loadTestData = function () {
    let lineReaderTest = new LineReader(this.testDataPath)
    let testFeatures = []
    let correctLabels = []
    while (block = getNextNLines(lineReaderTest, 1500)) {
        testFeatures = [...testFeatures, ...block.features]
        correctLabels = [...correctLabels, ...block.labels]
    }
    this.testData = {
        features: testFeatures,
        labels: correctLabels
    }
}

Benchmark.prototype.run = function () {
    if (!this.testData) {
        console.log('Benchmark data was not yet loaded. Cannot run benchmark.')
        return
    }

    let predictions = this.classifier.predict(this.testData.features)
    let classifications = predictions.map(p => p > this.keywordThreshold ? 1 : 0)

    let keywordsTotal = this.testData.labels.filter(l => l === 1).length
    let regularTermsTotal = this.testData.labels.filter(l => l === 0).length
    let keywordsCorrect = 0
    let regularTermsCorrect = 0
    classifications.forEach((classification, i) => {
        let correct = this.testData.labels[i]
        if (correct === 0 && classification === correct) {
            regularTermsCorrect++
        }
        if (correct === 1 && classification === correct) {
            keywordsCorrect++
        }
    })
    let predictionsCorrect = classifications.filter((c, i) => {
        return c === this.testData.labels[i]
    })
    let predictionRate = predictionsCorrect.length / predictions.length
    let predictionRateRegular = regularTermsCorrect/regularTermsTotal
    let predictionRateKeywords = keywordsCorrect/keywordsTotal
    let predictedKeywords = classifications.filter(c => c === 1).length
    let keywordPrecision = keywordsCorrect/predictedKeywords

    // Print evaluation
    let evaluation = new ValueList('Training evaluation', [
        [
            {
                key: 'Correct predictions total',
                value: predictionRate,
                type: 'gauge',
                max: 1,
                label: `${roundToDecimals(predictionRate * 100, 2)} %`
            }
        ],[
            {
                key: 'Correct predictions for regular terms',
                value: predictionRateRegular,
                type: 'gauge',
                max: 1,
                label: `${roundToDecimals(predictionRateRegular * 100, 2)} % (${regularTermsCorrect}/${regularTermsTotal})`
            },{
                key: 'Correct predictions for keywords',
                value: predictionRateKeywords,
                type: 'gauge',
                max: 1,
                label: `${roundToDecimals(predictionRateKeywords * 100, 2)} % (${keywordsCorrect}/${keywordsTotal})`
            },{
                key: 'Prediction precision',
                value: keywordPrecision,
                type: 'gauge',
                max: 1,
                label: `${roundToDecimals(keywordPrecision * 100, 2)} % (${keywordsCorrect}/${predictedKeywords} predicted keywords were actually keywords)`
            }
        ]
    ], {
        keyWidth: 40
    })
    evaluation.print()
}

module.exports = Benchmark