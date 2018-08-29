// Libraries
const fs = require('fs')
const Minimist = require('minimist')

// Modules
const ArticlePreprocessor = require('../modules/preprocessor/pp-article')
const KeywordsPreprocessor = require('../modules/preprocessor/pp-keywords')
const Matcher = require('../modules/training/matcher')
const Storage = require('./util/storage-interface')

// Global config
const APP_ROOT = require('app-root-path')
const d = new Date()
const dateString = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}-`+
    `${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}`
const EXPORT_FILENAME_TRAINING = `training.${dateString}.csv`
const EXPORT_FILENAME_TEST = `test.${dateString}.csv`

const { countArrayElements } = require('../modules/util')
const { terminate } = require('./util/script-util')
const { scaledSigmoid } = require('../modules/search-term-extraction/training-data-util')

const USAGE_STRING = `
Usage of this script:

yarn run generate || npm run generate
    -h, --help                (show this help)
    -e, --export-path         (where to store the generated data, defaults to ./data/)
    -n, --normalize           (if present, values are normalized to the range [0,1])
    --tf                      (include termFrequency)
    --fo                      (include firstOccurrence)
    --ptype                   (include paragraphType)
    --pos                     (include POS)
    --calais-entity           (include calais entity vector)
`

const KNOWN_CALAIS_ENTITIES = [ "Anniversary", "City", "Company", "Continent", "Country", 
    "Editor", "EmailAddress", "EntertainmentAwardEvent", "Facility", "FaxNumber", "Holiday", 
    "IndustryTerm", "Journalist", "MarketIndex", "MedicalCondition", "MedicalTreatment", 
    "Movie", "MusicAlbum", "MusicGroup", "NaturalFeature", "OperatingSystem", "Organization", 
    "Person", "PharmaceuticalDrug", "PhoneNumber", "PoliticalEvent", "Position", "Product", 
    "ProgrammingLanguage", "ProvinceOrState", "PublishedMedium", "RadioProgram", 
    "RadioStation", "Region", "SportsEvent", "SportsGame", "SportsLeague", "Technology", 
    "TVShow", "TVStation", "URL"]

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
    let normalize = options.normalize ? true : false

    // construct string
    let csvString = `${kw.stemmedTerm},${stringFromList(kw.originalTerms, '|')},`
    if (options.fields.indexOf('tf') >= 0) {
        csvString += `${normalize ? scaledSigmoid(kw.termFrequency-1) : kw.termFrequency},`
    }
    if (options.fields.indexOf('fo') >= 0) {
        csvString += `${kw.firstOccurrence},`
    }
    if (options.fields.indexOf('ptype') >= 0) {
        csvString += `${normalize ? scaledSigmoid(numH1) : numH1},` +
            `${normalize ? scaledSigmoid(numH2) : numH2},` + 
            `${normalize ? scaledSigmoid(numP) : numP},` + 
            `${normalize ? scaledSigmoid(numLi) : numLi},` + 
            `${normalize ? scaledSigmoid(numOther) : numOther},`
    }
    if (options.fields.indexOf('pos') >= 0) {
        csvString += `${normalize ? scaledSigmoid(kw.pos.nouns.length) : kw.pos.nouns.length},` + 
            `${normalize ? scaledSigmoid(kw.pos.verbs.length) : kw.pos.verbs.length},` +
            `${normalize ? scaledSigmoid(kw.pos.adjectives.length) : kw.pos.adjectives.length},` + 
            `${normalize ? scaledSigmoid(kw.pos.adverbs.length) : kw.pos.adverbs.length},` + 
            `${normalize ? scaledSigmoid(kw.pos.rest.length) : kw.pos.rest.length},`     
    }
    if (options.fields.indexOf('calais-entity') >= 0) {
        // [ isCalaisEntity, ...KNOWN_CALAIS_ENTITIES, Other ]
        let calaisVector = new Array(KNOWN_CALAIS_ENTITIES.length + 2).fill(0)
        if (kw.calaisEntityType) {
            calaisVector[0] = 1
            let entityTypeIndex = KNOWN_CALAIS_ENTITIES.indexOf(kw.calaisEntityType)
            if (entityTypeIndex < 0) {
                calaisVector[calaisVector.length - 1] = 1
            } else {
                calaisVector[entityTypeIndex+1] = 1
            }
        }
        csvString += `${calaisVector.toString()},`
    }
    csvString += `${isKeyword}\n`
    return csvString
}

// Read additional config from command line
let argv = Minimist(process.argv.slice(2))
if (argv['h'] || argv['help']) {
    console.log(USAGE_STRING)
    return
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
if (argv['calais-entity']) includeFields.push('calais-entity')
let normalize = argv['n'] || argv['normalize'] || false

console.log()
//console.log(`Reading data from file ${storageFilePathAbsolute} ...`)
console.log(`Exporting training data to ${exportPath} ...`)
console.log(`Including fields: ${stringFromList(includeFields, ', ')}`)
console.log()

let storage = new Storage()
storage.init().then(async () => {

    let articleIds = await storage.getArticleIds({gettyMeta: true})
    let articles = await storage.getArticles(articleIds)

    // Start processing
    console.log(`Writing to file ${exportPath}${EXPORT_FILENAME_TRAINING} ...`)
    let termsTotal = 0
    let articlesTotal = articles.length
    let articleIndex = 0
    for (let article of articles) {

        articleIndex++

        // Preprocess data
        let articlePreprocessor = new ArticlePreprocessor(article)
        let keywordsPreprocessor = new KeywordsPreprocessor(article.leadImage)
        await articlePreprocessor.preprocess()
        await keywordsPreprocessor.preprocess()
        let matcher = new Matcher(articlePreprocessor.getProcessedTerms(), 
            keywordsPreprocessor.extendedKeywordList)
        matcher.match()
        let keywords = matcher.getKeywordTerms()
        for (let kw of keywords) {
            articlePreprocessor.setKeyword(kw.stemmedTerm)
        }

        // Create a CSV block of training data
        let flaggedTerms = articlePreprocessor.getProcessedTerms(null, true) // exclude stopwords
        termsTotal += flaggedTerms.length
        console.log(`(${articleIndex}/${articlesTotal}) - ${article._id} - ${article.url} - ${flaggedTerms.filter(term => term.isKeyword).length} keywords`)
        let trainingCsv = ''
        let testCsv = ''
        for (let index in flaggedTerms) {
            let term = flaggedTerms[index]
            if (index % 10 === 0) {
                testCsv += termToCSV(term, {fields: includeFields, normalize})
            } else {
                trainingCsv += termToCSV(term, {fields: includeFields, normalize})
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

}).catch(error => {
    terminate(error.message, 1)
})