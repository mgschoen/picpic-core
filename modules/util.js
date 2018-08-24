const Natural = require('natural')
const NGrams = Natural.NGrams
const Tokenizer = new Natural.WordTokenizer()

const Stopwords = [...Natural.stopwords, 'she', 'new']
const nonWordChars = '[^A-Za-zА-Яа-я0-9_]+'
const nonWordNonPunctuationChars = '[^A-Za-zА-Яа-я0-9_,\\.\\!\\?\\:]+'

function arrayEndsWith (arrayA, arrayB) {
    let indexA = arrayA.length - 1
    let indexB = arrayB.length - 1
    while (indexA >= 0 && indexB >= 0 && 
        arrayA[indexA] === arrayB[indexB]) {
            indexA--
            indexB--
    }
    if (indexB < 0)
        return true
    return false
}

function arrayStartsWith (arrayA, arrayB) {
    let indexA = 0
    let indexB = 0
    while (indexA < arrayA.length && indexB < arrayB.length && 
        arrayA[indexA] === arrayB[indexB]) {
            indexA++
            indexB++
    }
    if (indexB >= arrayB.length)
        return true
    return false
}

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

function filterStopwords (terms) {
    return terms.filter(term => {
        if (isStopword(term.stemmedTerm)) {
            return false
        }
        for (let originalTerm of term.originalTerms) {
            if (isStopword(originalTerm)) {
                return false
            }
        }
        return true
    })
}

function findOverlapLeft (stringA, stringB) {
    let wordsA = tokenizePlainText(stringA)
    let wordsB = tokenizePlainText(stringB)
    if (wordsB.length === 0)
        return ''
    if (arrayStartsWith(wordsA, wordsB))
        return stringB
    return findOverlapLeft(stringA, concatStrings(wordsB.slice(1, wordsB.length)))
}

function findOverlapRight (stringA, stringB) {
    let wordsA = tokenizePlainText(stringA)
    let wordsB = tokenizePlainText(stringB)
    if (wordsB.length === 0)
        return ''
    if (arrayEndsWith(wordsA, wordsB))
        return stringB
    return findOverlapRight(stringA, concatStrings(wordsB.slice(0, wordsB.length - 1)))
}

function findOverlap (stringA, stringB) {
    let overlapRight = findOverlapRight(stringA, stringB)
    let overlapLeft = findOverlapLeft(stringA, stringB)
    return {
        left: overlapLeft,
        right: overlapRight
    }
}

function getNextNLines (lineReader, n) {
    let numLines = 0,
        lineBuffer = null,
        features = [],
        labels = []
    while ((lineBuffer = lineReader.next()) && numLines < n) {
        let line = lineBuffer.toString('ascii')
        let values = line.split(',').slice(2).map(v => parseFloat(v))
        let label = values.pop()
        features.push(values)
        labels.push(label)
        numLines++
    }
    if (numLines === 0) {
        return null
    }
    return { numLines, features, labels }
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
    countArrayElements,
    filterStopwords,
    findOverlap,
    getNextNLines,
    getNGrams,
    isStopword,
    objectToArray,
    roundToDecimals,
    stemPlainText,
    tokenizePlainText
}