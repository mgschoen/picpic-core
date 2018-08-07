const Natural = require('natural')
const NGrams = Natural.NGrams
const Tokenizer = new Natural.WordTokenizer()

const Stopwords = Natural.stopwords
const nonWordChars = '[^A-Za-zА-Яа-я0-9_]+'
const nonWordNonPunctuationChars = '[^A-Za-zА-Яа-я0-9_,\\.\\!\\?\\:]+'

function arrayToObject (array, keyForKey) {
    let object = {}
    for (let item of array) {
        let objectItem = {...item}
        let key = item[keyForKey]
        delete objectItem[keyForKey]
        object[key] = objectItem
    }
    return object
}

function concatStrings (strings, joiner) {
    let joinCharacter = joiner || ' '
    return strings.reduce((acc, cur) => 
        acc.length === 0 ? cur : `${acc}${joinCharacter}${cur}`, '')
}

function constructSearchRegex (term, wordSeparator, termBorder) {
    let borderSeparator = termBorder || wordSeparator
    let searchTerm = term.replace(/ /g, wordSeparator)
    return new RegExp(
        '(^'  + searchTerm + borderSeparator + '|' + 
        borderSeparator + searchTerm + borderSeparator + '|' + 
        borderSeparator + searchTerm + '$)', 'g'
    )
}

function getNGrams (tokens, fullText, minLength, maxLength) {
    let allNGrams = []
    for (let i = minLength; i <= maxLength; i++) {
        allNGrams = [ ...allNGrams, ...NGrams.ngrams(tokens, i) ]
    }
    let allowedNGrams = allNGrams.filter(ngram => {
        let first = ngram[0], last = ngram[ngram.length - 1]
        if (isStopword(first) || isStopword(last)) {
            return false
        }
        let regex = constructSearchRegex(concatStrings(ngram), nonWordNonPunctuationChars, nonWordChars)
        if (fullText.search(regex) < 0) {
            return false
        }
        return true
    })
    let concatenatedNGrams = allowedNGrams.map(ngram => concatStrings(ngram))
    return concatenatedNGrams
}

function isStopword (term) {
    return Stopwords.indexOf(term.toLowerCase()) >= 0
}

function objectToArray (object, keyForKey) {
    let array = []
    for (let key in object) {
        let item = {...object[key]}
        item[keyForKey] = key
        array.push(item)
    }
    return array
}

function roundToDecimals (value, decimals) {
    let dec = decimals || 2
    let factor = Math.pow(10, dec)
    return Math.round(value * factor) / factor
}

function stemPlainText (plainText) {
    let tokens = tokenizePlainText(plainText)
    let stemmedTokens = tokens.map(token => Natural.PorterStemmer.stem(token))
    return concatStrings(stemmedTokens)
}

function tokenizePlainText (plainText) {
    return Tokenizer.tokenize(plainText)
}

module.exports = { 
    // Definitions
    nonWordChars,
    nonWordNonPunctuationChars,
    Stopwords,

    // Methods
    arrayToObject,
    concatStrings,
    constructSearchRegex,
    getNGrams,
    isStopword,
    objectToArray,
    roundToDecimals,
    stemPlainText,
    tokenizePlainText
}