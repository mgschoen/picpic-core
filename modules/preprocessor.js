const Natural = require('natural')

const Tokenizer = new Natural.WordTokenizer()
const Stopwords = Natural.stopwords
const NGrams = Natural.NGrams

function concatStrings (paragraphs) {
    return paragraphs.reduce((acc, cur) => 
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

function getNGrams (tokens, minLength, maxLength) {
    let allNGrams = []
    for (let i = minLength; i <= maxLength; i++) {
        allNGrams = [ ...allNGrams, ...NGrams.ngrams(tokens, i) ]
    }
    let allowedNGrams = allNGrams.filter(ngram => {
        let first = ngram[0], last = ngram[ngram.length - 1]
        if (Stopwords.indexOf(first) >= 0 || Stopwords.indexOf(last) >= 0) {
            return false
        }
        return true
    })
    let concatenatedNGrams = allowedNGrams.map(ngram => concatStrings(ngram))
    return concatenatedNGrams
}

function assignParagraphTypes (paragraphs) {
    let allTerms = {}
    for (let p of paragraphs) {
        let tokens = Tokenizer.tokenize(p.content)
        let ngrams = getNGrams(tokens, 2, 4)
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

let Preprocessor = function (paragraphs) {
    this.originalParagraphs = paragraphs
    this.fullText = null
    this.fullTextStemmed = null
    this.allTerms = null
    this.stemmedUniqueTerms = {}
}

Preprocessor.prototype.preprocess = function () {
    this.fullText = generateFullText(this.originalParagraphs)
    this.fullTextStemmed = stemPlainText(this.fullText)
    this.allTerms = assignParagraphTypes(this.originalParagraphs)
}

module.exports = Preprocessor