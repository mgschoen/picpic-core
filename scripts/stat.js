// Libraries
const Minimist = require('minimist')
const RestClient = require('node-rest-client').Client
const rest = new RestClient()

const ArticlePreprocessor = require('../modules/preprocessor/pp-article')
const StatisticalSearchTermExtractor = require('../modules/search-term-extraction/ste-statistical')

// Read article ID from command line
let argv = Minimist(process.argv.slice(2))
let articleID = argv._[0]
if (Number.isNaN(parseInt(articleID))) {
    console.log(`The article ID you specified (${articleID}) is not valid.`)
    process.exit()
}

// Request article from API
rest.get(`http://picpic-api.argonn.me/article/${articleID}/`, async (data, response) => {

    // Preprocess the article for analysis
    let paragraphs = data.article.paragraphs
    paragraphs.unshift({
        type: 'H1',
        content: data.article.headline
    })

    let preprocessor = new ArticlePreprocessor(paragraphs)
    await preprocessor.preprocess()

    let searchTermExtractor = new StatisticalSearchTermExtractor(preprocessor.stemmedUniqueTerms)
    searchTermExtractor.generateSearchTerm()

    console.log(searchTermExtractor)

})