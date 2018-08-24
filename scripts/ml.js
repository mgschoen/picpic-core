// Libraries
const Minimist = require('minimist')
const RestClient = require('node-rest-client').Client
const rest = new RestClient()

const ArticlePreprocessor = require('../modules/preprocessor/pp-article')
const LearningSearchTermExtractor = require('../modules/search-term-extraction/ste-learning')
const ValueList = require('../modules/print/value-list')

const { terminate } = require('./util/script-util')
const { concatStrings } = require('../modules/util')

// Read and check command line arguments
let argv = Minimist(process.argv.slice(2))
let articleID = argv._[0]
let threshold = parseFloat(argv._[1]) || 0.5
let modelType = argv['t'] || 'svm'
let modelFile = argv['m']
if (Number.isNaN(parseInt(articleID))) {
    terminate(`The article ID you specified (${articleID}) is not valid.`)
}
if (!modelFile) {
    terminate('Please specify the path to a trained model (-m or --model)')
}

// Request article from API
rest.get(`http://picpic-api.argonn.me/article/${articleID}/`, async (data, response) => {

    let preprocessor = new ArticlePreprocessor(data)
    await preprocessor.preprocess()

    try {
        let searchTermExtractor = new LearningSearchTermExtractor(
            modelType, modelFile, preprocessor.stemmedUniqueTerms, threshold
        )
        let query = searchTermExtractor.generateSearchTerm()

        let extractedKeywords = searchTermExtractor.getKeywords()
        let keywordStrings = extractedKeywords.map(kw => kw.originalTerms[0])
        let numKeywords = extractedKeywords.length
        let termsTotal = searchTermExtractor.termProbabilities.length
        let insights = new ValueList('Insights', [
            [
                { key: 'Threshold', value: threshold },
                { 
                    key: 'Selection rate', 
                    value: extractedKeywords.length,
                    max: searchTermExtractor.termProbabilities.length,
                    label: `${numKeywords}/${termsTotal} terms selected`,
                    type: 'gauge'
                },
                { key: 'Selected terms', value: concatStrings(keywordStrings, ', ') },
                { key: 'Generated query', value: query }
            ]
        ])
        insights.print()

        console.log('Done')
    } catch (error) {
        terminate(error.message + error.stack, 1)
    }
})