// Libraries
const Minimist = require('minimist')
const RestClient = require('node-rest-client').Client
const rest = new RestClient()

const ArticlePreprocessor = require('../modules/preprocessor/pp-article')
const StatisticalSearchTermExtractor = require('../modules/search-term-extraction/ste-statistical')

const TermPlot = require('../modules/print/term-plot')
const ValueList = require('../modules/print/value-list')

const { concatStrings } = require('../modules/util')
const { terminate } = require('./script-util')

// Read article ID from command line
let argv = Minimist(process.argv.slice(2))
let articleID = argv._[0]
if (Number.isNaN(parseInt(articleID))) {
    terminate(`The article ID you specified (${articleID}) is not valid.`, 0)
}
let threshold = parseFloat(argv._[1]) || 0.5

// Request article from API
rest.get(`http://picpic-api.argonn.me/article/${articleID}/`, async (data, response) => {

    let preprocessor = new ArticlePreprocessor(data)
    await preprocessor.preprocess()

    let searchTermExtractor = new StatisticalSearchTermExtractor(
        preprocessor.stemmedUniqueTerms, threshold)
    let query = searchTermExtractor.generateSearchTerm()

    let extractedKeywords = searchTermExtractor.getKeywords()
    let otherTerms = searchTermExtractor.getNonKeywords()
    let plot = new TermPlot('Selection plotted', otherTerms, extractedKeywords, {
        height: searchTermExtractor.maxTermFrequency + 2
    })
    plot.print()

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

})