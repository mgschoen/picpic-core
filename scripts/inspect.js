// Libraries
const Minimist = require('minimist')
const CliColor = require('cli-color')
const RestClient = require('node-rest-client').Client
const rest = new RestClient()

const ArticlePreprocessor = require('../modules/preprocessor/pp-article')
const KeywordsPreprocessor = require('../modules/preprocessor/pp-keywords')
const Matcher = require('../modules/training/matcher')

const TermTable = require('../modules/print/term-table')
const TermPlot = require('../modules/print/term-plot')
const ValueList = require('../modules/print/value-list')

const { roundToDecimals } = require('../modules/util')

const LINE_STYLE_TITLE = [CliColor.red, CliColor.bold]

// Read article ID from command line
let argv = Minimist(process.argv.slice(2))
let articleID = argv._[0]
if (Number.isNaN(parseInt(articleID))) {
    console.log(`The article ID you specified (${articleID}) is not valid.`)
    process.exit()
}

// Request article from API
rest.get(`http://localhost:27112/article/${articleID}/`, async (data, response) => {

    // We can only train our system if we know something about the associated image
    if (data.leadImage) {

        // Print some details about the article
        let articleInfo = new ValueList('Article', [
            [ { key: 'Headline', value: data.article.headline } ],
            [ { key: 'Image caption', value: data.leadImage.caption } ]
        ], {
            keyWidth: 20,
            keyStyles: LINE_STYLE_TITLE
        })
        articleInfo.print()

        // Preprocess the article for analysis
        let articlePreprocessor = new ArticlePreprocessor(data)
        await articlePreprocessor.preprocess()

        // Preprocess keywords for analysis
        let keywordsPreprocessor = new KeywordsPreprocessor(data.leadImage)
        await keywordsPreprocessor.preprocess()
         
        // Match image keywords with terms from the text
        let matcher = new Matcher(articlePreprocessor.getProcessedTerms(), 
            keywordsPreprocessor.extendedKeywordList)
        matcher.match()
        let matches = matcher.getKeywordTerms()

        // Print some statistics about the article
        let stats = matcher.stats
        let pos = stats.pos
        let statsOutput = new ValueList('Stats', [
            // Block: Keyword matching
            [{
                key: 'Terms total',
                value: stats.termsTotal
            }, {
                key: 'Keyword matching rate',
                type: 'gauge',
                value: stats.matchesTotal,
                max: stats.keywordsTotal,
                label: `${stats.matchesTotal}/${stats.keywordsTotal} matched (${stats.matchPercentage} %)`
            // Block: Term frequency
            }], [
                { key: 'Term frequency max', value: stats.termFrequency.max}, 
                { key: 'Term frequency mean', value: stats.termFrequency.mean}, 
                { key: 'Term frequency median', value: stats.termFrequency.median},
                { key: 'Term frequency SD', value: stats.termFrequency.std}
            // Block: First occurrence
            ], [{
                key: 'First occurrence mean',
                type: 'gauge',
                value: stats.firstOccurrence.mean,
                max: 1,
                label: `${Math.round(stats.firstOccurrence.mean * 10000) / 100}%`
            }, {
                key: 'First occurrence median',
                type: 'gauge',
                value: stats.firstOccurrence.median,
                max: 1,
                label: `${Math.round(stats.firstOccurrence.median * 10000) / 100}%`
            }, {
                key: 'First occurrence SD',
                value: stats.firstOccurrence.std
            // Block: Part-of-speech
            }], [{
                key: 'POS mean',
                value: `${roundToDecimals(pos.nouns.mean)} - ${roundToDecimals(pos.verbs.mean)} - ` + 
                    `${roundToDecimals(pos.adjs.mean)} - ${roundToDecimals(pos.advs.mean)} - ` + 
                    `${roundToDecimals(pos.rest.mean)}`
            }, {
                key: 'POS median',
                value: `${pos.nouns.median} - ${pos.verbs.median} - ${pos.adjs.median} - ` + 
                    `${pos.advs.median} - ${pos.rest.median}`
            }, {
                key: 'POS standard deviation',
                value: `${roundToDecimals(pos.nouns.std)} - ${roundToDecimals(pos.verbs.std)} - ` + 
                    `${roundToDecimals(pos.adjs.std)} - ${roundToDecimals(pos.advs.std)} - ` + 
                    `${roundToDecimals(pos.rest.std)}`
            }]
        ], {
            keyWidth: 30
        })
        statsOutput.print()

        // Print a table with details about the matched terms
        let tableData = []
        for (let match of matches) {
            let entry = {
                termStemmed: match.stemmedTerm,
                termsArticle: match.originalTerms,
                termsKeyword: match.originalTermsKW,
                termFrequency: match.termFrequency,
                firstOccurrence: match.firstOccurrence,
                paragraphTypes: match.containingElements,
                pos: match.pos,
                entityType: match.calaisEntityType || '-',
                keywordType: match.keywordType
            }
            tableData.push(entry)
        }
        let termTable = new TermTable(tableData)
        termTable.print()

        // Plot term frequency and first occurrence of keywords
        let nonKeywordTerms = matcher.getNonKeywordTerms().filter(term => term.termFrequency > 1)
        let keywordTerms = matcher.getKeywordTerms().filter(term => term.termFrequency > 1)
        let plot = new TermPlot('Term plot', nonKeywordTerms, keywordTerms, { height: stats.termFrequency.max })
        plot.print()

    } else {
        console.log('Could not perform my cool operations because the article ' +
            'you selected has no lead image assigned. Bummer.')
    }

})