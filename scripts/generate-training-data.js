// Libraries
const fs = require('fs')
const Minimist = require('minimist')
const Loki = require('lokijs')
const lfsa = require('../node_modules/lokijs/src/loki-fs-structured-adapter')

// Modules
const ArticlePreprocessor = require('../modules/preprocessor/pp-article')
const KeywordsPreprocessor = require('../modules/preprocessor/pp-keywords')
const Matcher = require('../modules/training/matcher')

// Global config
const APP_ROOT = require('app-root-path')
const STORAGE_REQUIRED_COLLECTIONS = [ 'articles', 'keywords' ]
const d = new Date()
const dateString = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}-`+
    `${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}`
const EXPORT_FILENAME_TRAINING = `training.${dateString}.csv`
const EXPORT_FILENAME_TEST = `test.${dateString}.csv`

const { countArrayElements } = require('../modules/util')
const { terminate } = require('./script-util')

const USAGE_STRING = `
Usage of this script:

yarn run generate || npm run generate
    -s, --storage-path        (location of the storage file, required)
    -e, --export-path         (where to store the generated data, defaults to ./data/)
    --tf                      (include termFrequency)
    --fo                      (include firstOccurrence)
    --ptype                   (include paragraphType)
    --pos                     (include POS)
`

/**
 * Concatenates a list of values to a string with
 * a specified separator string between the values
 * @param {array} values 
 * @param {string} separator 
 * @returns {string}
 */
function stringFromList (values, separator) {
    let string = ''
    let num = values.length
    for (let index in values) {
        let value = values[index]
        if (index >= num - 1) {
            string += value
        } else {
            string += (value + separator)
        }
    }
    return string
}

// stemmedTerm,originalTerms,termFrequency,firstOccurrence,numH1,numH2,numP,numLi,numOther,...
// ...numPosNoun,numPosVerb,numPosAdj,numPosAdv,numPosRest,isKeyword
function termToCSV (kw, options) {

    // preprocess
    let countContainingElements = countArrayElements(kw.containingElements)
    let knownContainingElements = [ 'H1', 'H2', 'P', 'LI' ]
    let numH1 = countContainingElements.H1 || 0
    let numH2 = countContainingElements.H2 || 0
    let numP = countContainingElements.P || 0
    let numLi = countContainingElements.LI || 0
    let numOther = 0
    for (let elem in countContainingElements) {
        if (knownContainingElements.indexOf(elem) < 0) {
            numOther += countContainingElements[elem]
        }
    }
    let isKeyword = kw.isKeyword ? '1' : '0'

    // construct string
    let csvString = `${kw.stemmedTerm},${stringFromList(kw.originalTerms, '|')},`
    if (options.fields.indexOf('tf') >= 0) {
        csvString += `${kw.termFrequency},`
    }
    if (options.fields.indexOf('fo') >= 0) {
        csvString += `${kw.firstOccurrence},`
    }
    if (options.fields.indexOf('ptype') >= 0) {
        csvString += `${numH1},${numH2},${numP},${numLi},${numOther},`
    }
    if (options.fields.indexOf('pos') >= 0) {
        csvString += `${kw.pos.nouns.length},${kw.pos.verbs.length},` +
        `${kw.pos.adjectives.length},${kw.pos.adverbs.length},${kw.pos.rest.length},`     
    }
    csvString += `${isKeyword}\n`
    return csvString
}

// Read additional config from command line
let argv = Minimist(process.argv.slice(2))
let storageFilePath = argv['s'] || argv['storage-path']
if (!storageFilePath) {
    terminate('No storage path specified (use command line argument -s or --storage-path)\n' + USAGE_STRING, 9)
}
let exportPath = argv['e'] || argv['export-path'] || `${APP_ROOT}/data/`
if (exportPath[exportPath.length - 1] !== '/') {
    exportPath += '/'
}
let includeFields = []
if (argv['tf']) includeFields.push('tf')
if (argv['fo']) includeFields.push('fo')
if (argv['pos']) includeFields.push('pos')
if (argv['ptype']) includeFields.push('ptype')

console.log()
console.log(`Reading data from file ${storageFilePath} ...`)
console.log(`Exporting training data to ${exportPath} ...`)
console.log(`Including fields: ${stringFromList(includeFields, ', ')}`)
console.log()

// Connect to database
let adapter = new lfsa()
let db = new Loki(storageFilePath, {
    adapter: adapter
})
db.loadDatabase({}, async err => {

    if (err) 
        terminate(`Error loading database: ${err.message}`, 1)

    let missingCollections = []
    for (let collectionName of STORAGE_REQUIRED_COLLECTIONS) {
        let collection = db.getCollection(collectionName)
        if (!collection) {
            missingCollections.push(collectionName)
        }
    }

    if (missingCollections.length > 0) 
        terminate(`Could not find required collection(s) ${missingCollections}`, 1)

    console.log('DB loaded successfully\n')
    
    // Query DB
    let articlesCollection = db.getCollection('articles')
    let keywordsCollection = db.getCollection('keywords')
    let articles = articlesCollection.find({gettyMeta: true})

    // Start processing
    console.log(`Writing to file ${exportPath}${EXPORT_FILENAME_TRAINING} ...`)
    let termsTotal = 0
    for (let dbEntry of articles) {
        let article = {...dbEntry}
        article.leadImage = {...dbEntry.leadImage}
        article.leadImage.keywords = 
            keywordsCollection.find({"$loki": { "$in": dbEntry.leadImage.keywords }})
        
        // Preprocess data
        let paragraphs = article.article.paragraphs
        paragraphs.unshift({type: 'H1', content: `${article.article.headline}.`})
        let articlePreprocessor = new ArticlePreprocessor(paragraphs)
        let keywordsPreprocessor = new KeywordsPreprocessor(article.leadImage)
        await articlePreprocessor.preprocess()
        await keywordsPreprocessor.preprocess()
        let matcher = new Matcher(articlePreprocessor.getStemmedTerms(), 
            keywordsPreprocessor.extendedKeywordList)
        let keywords = matcher.getKeywordTerms()
        for (let kw of keywords) {
            articlePreprocessor.setKeyword(kw.stemmedTerm)
        }

        // Create a CSV block of training data
        let flaggedTerms = articlePreprocessor.getStemmedTerms(null, true) // exclude stopwords
        termsTotal += flaggedTerms.length
        console.log(`${article.$loki} - ${article.url} - ${flaggedTerms.filter(term => term.isKeyword).length} keywords`)
        let trainingCsv = ''
        let testCsv = ''
        for (let index in flaggedTerms) {
            let term = flaggedTerms[index]
            if (index % 10 === 0) {
                testCsv += termToCSV(term, {fields: includeFields})
            } else {
                trainingCsv += termToCSV(term, {fields: includeFields})
            }
        }

        // Write CSV to file
        try {
            fs.appendFileSync(exportPath + EXPORT_FILENAME_TRAINING, trainingCsv)
            fs.appendFileSync(exportPath + EXPORT_FILENAME_TEST, testCsv)
        } catch (error) {
            terminate(error.message, 1)
        }
    }

    console.log()
    console.log(`Successfully processed ${termsTotal} terms`)
    console.log()
    
})