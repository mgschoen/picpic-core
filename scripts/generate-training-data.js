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
const EXPORT_FILENAME = `training.${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}-`+
    `${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}.csv`

/**
 * Log an error message and gracefully terminate the process
 * with the specified exit code
 * @param {string} errorMessage 
 * @param {number} exitCode 
 */
function terminate (errorMessage, exitCode) {
    console.error(errorMessage)
    process.exit(exitCode)
}

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

/**
 * Counts how many times each distinct element is
 * contained in an array. Returns the results as 
 * an object.
 * 
 * E.g. the array 
 *   [ 'apple', 'strawberry', 'apple', 'apple', 'potato', 'strawberry' ]
 * would return 
 *   { 'apple': 3, 'potato': 1, 'strawberry': 2  }
 * @param {array} array 
 * @return {object}
 */
function countArrayElements (array) {
    let count = {}
    for (let elem of array) {
        if (count[elem]) {
            count[elem] += 1
        } else {
            count[elem] = 1
        }
    }
    return count
}

// stemmedTerm,originalTerms,termFrequency,firstOccurrence,numH1,numH2,numP,numLi,numOther,...
// ...numPosNoun,numPosVerb,numPosAdj,numPosAdv,numPosRest,isKeyword
function termToCSV (kw) {
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
    return `${kw.stemmedTerm},${stringFromList(kw.originalTerms, '|')},` +
        `${kw.termFrequency},${kw.firstOccurrence},${numH1},${numH2},${numP},${numLi},` +
        `${numOther},${kw.pos.nouns.length},${kw.pos.verbs.length},` + 
        `${kw.pos.adjectives.length},${kw.pos.adverbs.length},${kw.pos.rest.length},` +
        `${isKeyword}\n`
}

// Read additional config from command line
let argv = Minimist(process.argv.slice(2))
let storageFilePath = argv['s'] || argv['storage-path']
if (!storageFilePath) {
    terminate('No storage path specified (use command line argument -s or --storage-path)', 9)
}
let exportPath = argv['e'] || argv['export-path'] || `${APP_ROOT}/data/`
if (exportPath[exportPath.length - 1] !== '/') {
    exportPath += '/'
}

console.log()
console.log(`Reading data from file ${storageFilePath} ...`)
console.log(`Exporting training data to ${exportPath} ...`)
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
    console.log(`Writing to file ${exportPath}${EXPORT_FILENAME} ...`)
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
        let flaggedTerms = articlePreprocessor.getStemmedTerms()
        termsTotal += flaggedTerms.length
        console.log(`${article.$loki} - ${article.url} - ${flaggedTerms.filter(term => term.isKeyword).length} keywords`)
        let csv = ''
        for (let term of flaggedTerms) {
            csv += termToCSV(term)
        }

        // Write CSV to file
        try {
            fs.appendFileSync(exportPath + EXPORT_FILENAME, csv)
        } catch (error) {
            terminate(error.message, 1)
        }
    }

    console.log()
    console.log(`Successfully processed ${termsTotal} terms`)
    console.log()
    
})