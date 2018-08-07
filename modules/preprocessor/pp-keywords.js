const {
    concatStrings,
    getNGrams,
    isStopword,
    stemPlainText,
    tokenizePlainText
 } = require('../util')

function getCaptionTerms (caption) {
    let tokens = tokenizePlainText(caption)
    let tokensWithoutStopwords = tokens.filter(token => !isStopword(token))
    let ngrams = getNGrams(tokens, caption, 2, 4)
    return [...tokensWithoutStopwords, ...ngrams]
}

function stemAndCombine (terms) {
    let stemmedCaptionTerms = {}
    for (let term of terms) {
        let stemmedTerm = stemPlainText(term)
        if (stemmedCaptionTerms[stemmedTerm]) {
            let originalTerms = stemmedCaptionTerms[stemmedTerm].originalTerms
            if (originalTerms.indexOf(term) < 0) {
                originalTerms.push(term)
            }
        } else {
            stemmedCaptionTerms[stemmedTerm] = {
                originalTerms: [term]
            }
        }
    }
    return stemmedCaptionTerms
}

function stemKeywords (keywords) {
    let stemmedKeywords = []
    for (let kw of keywords) {
        stemmedKeywords.push({
            keyword_id: kw.keyword_id,
            originalTerms: [ kw.text ],
            type: kw.type,
            relevance: kw.relevance,
            stemmedText: stemPlainText(kw.text)
        })
    }
    return stemmedKeywords
}

function inKeywordList (keywords, term) {
    let keywordsWithTerm = keywords.filter(kw => kw.stemmedText === term)
    return keywordsWithTerm.length > 0
}

function mergeKeywordsAndCaptionTerms (keywords, captionTerms) {
    let extendedKeywords = [...keywords]
    for (let term in captionTerms) {
        if (!inKeywordList(extendedKeywords, term)) {
            extendedKeywords.push({
                keyword_id: null,
                originalTerms: captionTerms[term].originalTerms,
                type: 'Caption',
                relevance: null,
                stemmedText: term
            })
        }
    }
    return extendedKeywords
}

let Preprocessor = function (leadImage) {
    this.originalTitle = leadImage.title
    this.originalCaption = leadImage.caption
    this.originalKeywords = leadImage.keywords
    this.stemmedKeywords = null
    this.captionTerms = null
    this.stemmedCaptionTerms = null
    this.extendedKeywordList = null
}

Preprocessor.prototype.preprocess = function () {
    return new Promise(async (resolve, reject) => {

        try {
            this.captionTerms = getCaptionTerms(concatStrings([
                `${this.originalTitle}.`, this.originalCaption
            ]))
            this.stemmedCaptionTerms = stemAndCombine(this.captionTerms)
            this.stemmedKeywords = stemKeywords(this.originalKeywords)
            this.extendedKeywordList = mergeKeywordsAndCaptionTerms(this.stemmedKeywords, 
                this.stemmedCaptionTerms)
            resolve()
        } catch (error) {
            reject(error)
        }

    })
}

module.exports = Preprocessor