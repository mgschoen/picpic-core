const Natural = require('natural')
const WordPOS = require('wordpos')

WordPOS.defaults = { stopwords: false }

const Tokenizer = new Natural.WordTokenizer()
const Stopwords = Natural.stopwords
const NGrams = Natural.NGrams
const Wordpos = new WordPOS()

const nonWordChars = '[^A-Za-zА-Яа-я0-9_]+'
const nonWordNonPunctuationChars = '[^A-Za-zА-Яа-я0-9_,\\.\\!\\?\\:]+'

function concatStrings (strings) {
    return strings.reduce((acc, cur) => 
        acc.length === 0 ? cur : `${acc} ${cur}`, '')
}

function generateFullText (paragraphs) {
    let contents = paragraphs.map(p => p.content)
    return concatStrings(contents)
}

function tokenizePlainText (plainText) {
    return Tokenizer.tokenize(plainText)
}

function stemPlainText (plainText) {
    let tokens = tokenizePlainText(plainText)
    let stemmedTokens = tokens.map(token => Natural.PorterStemmer.stem(token))
    return concatStrings(stemmedTokens)
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
        if (Stopwords.indexOf(first) >= 0 || Stopwords.indexOf(last) >= 0) {
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

function assignParagraphTypes (paragraphs, fullText) {
    let allTerms = {}
    for (let p of paragraphs) {
        let tokens = Tokenizer.tokenize(p.content)
        let ngrams = getNGrams(tokens, fullText, 2, 4)
        let terms = [...tokens, ...ngrams]
        for (let term of terms) {
            if (allTerms[term]) {
                allTerms[term].containingElements.push(p.type)
            } else {
                allTerms[term] = {
                    originalTerm: term,
                    containingElements: [p.type]
                }
            }
        }
    }
    return allTerms
}

async function assignPOS (terms) {

    function posRequestLoop (terms, keys, index, callback) {
        let key = keys[index]
        Wordpos.getPOS(terms[key].originalTerm).then(pos => {
            terms[key].pos = pos
            if (index < keys.length - 1) {
                posRequestLoop(terms, keys, index + 1, callback)
            } else {
                callback(null, terms)
            }
        }).catch(error => {
            callback(error)
        })
    }

    return new Promise((resolve, reject) => {
        posRequestLoop(terms, Object.keys(terms), 0, (err, terms) => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

function assignFirstOccurrences (terms, fullText) {
    for (let term in terms) {
        let searchRegex = constructSearchRegex(term, nonWordChars)
        let foIndex = fullText.search(searchRegex)
        let maxIndex = fullText.length
        let foRelative = foIndex / maxIndex
        if (foRelative < 0) {
            console.log(`${term}: ${foIndex} - ${searchRegex}`)
        }
        terms[term].firstOccurrence = foRelative
    }
}

let Preprocessor = function (paragraphs) {
    this.originalParagraphs = paragraphs
    this.fullText = null
    this.fullTextStemmed = null
    this.allTerms = null
    this.stemmedUniqueTerms = {}
}

Preprocessor.prototype.preprocess = function () {
    return new Promise(async (resolve, reject) => {

        try {
            this.fullText = generateFullText(this.originalParagraphs)
            this.fullTextStemmed = stemPlainText(this.fullText)
            this.allTerms = assignParagraphTypes(this.originalParagraphs, this.fullText)
            await assignPOS(this.allTerms)
            assignFirstOccurrences(this.allTerms, this.fullText)
            resolve()
        } catch (error) {
            reject(error)
        }

    })
}

module.exports = Preprocessor