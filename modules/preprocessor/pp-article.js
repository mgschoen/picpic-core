const WordPOS = require('wordpos')

WordPOS.defaults = { stopwords: false }

const Wordpos = new WordPOS()

const { 
    concatStrings,
    filterStopwords,
    stemPlainText,
    tokenizePlainText,
    getNGrams,
    constructSearchRegex,
    nonWordChars,
    isStopword
 } = require('../util')

function generateFullText (paragraphs) {
    let contents = paragraphs.map(p => p.content)
    return concatStrings(contents)
}

function assignParagraphTypes (paragraphs, fullText) {
    let allTerms = {}
    for (let p of paragraphs) {
        let tokens = tokenizePlainText(p.content)
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

function mergePOS (stemmedPOS, plainPOS) {
    let mergedPOS = { nouns:[], verbs:[], adjectives:[], adverbs:[], rest:[] }
    for (let posTag in mergedPOS) {
        if (stemmedPOS) {
            mergedPOS[posTag] = [...stemmedPOS[posTag]]
        }
        let newWords = plainPOS[posTag]
        for (let word of newWords) {
            let stemmedWord = stemPlainText(word)
            if (mergedPOS[posTag].indexOf(stemmedWord) < 0) {
                mergedPOS[posTag].push(stemmedWord)
            }
        }
    }
    return mergedPOS
}

function stemAndCombine (terms) {
    let combinedTerms = {}
    for (let term in terms) {
        let stemmedTerm = stemPlainText(term)
        let original = terms[term]
        let combined = combinedTerms[stemmedTerm]
        if (combined) {
            combined.originalTerms.push(term)
            combined.containingElements = 
                [...combined.containingElements, ...original.containingElements]
            combined.pos = mergePOS(combined.pos, original.pos)
            combined.firstOccurrence = Math.min(combined.firstOccurrence, original.firstOccurrence)
            combined.termFrequency += original.containingElements.length
        } else {
            combinedTerms[stemmedTerm] = {
                originalTerms: [term],
                containingElements: original.containingElements,
                pos: mergePOS(null, original.pos),
                firstOccurrence: original.firstOccurrence,
                termFrequency: original.containingElements.length
            }
        }
    }
    return combinedTerms
}

let Preprocessor = function (paragraphs) {
    this.originalParagraphs = paragraphs
    this.fullText = null
    this.fullTextStemmed = null
    this.allTerms = null
    this.stemmedUniqueTerms = null
}

Preprocessor.prototype.preprocess = function () {
    return new Promise(async (resolve, reject) => {

        try {
            this.fullText = generateFullText(this.originalParagraphs)
            this.fullTextStemmed = stemPlainText(this.fullText)
            this.allTerms = assignParagraphTypes(this.originalParagraphs, this.fullText)
            await assignPOS(this.allTerms)
            assignFirstOccurrences(this.allTerms, this.fullText)
            this.stemmedUniqueTerms = stemAndCombine(this.allTerms)
            resolve()
        } catch (error) {
            reject(error)
        }

    })
}

Preprocessor.prototype.getStemmedTerms = function (sortFunction, excludeStopwords) {
    if (this.stemmedUniqueTerms) {
        let allTerms = []
        let resultTerms
        // append stemmed terms to term object
        for (let term in this.stemmedUniqueTerms) {
            let entry = this.stemmedUniqueTerms[term]
            entry.stemmedTerm = term
            allTerms.push(entry)
        }
        // exclude stopwords if specified
        resultTerms = excludeStopwords ? filterStopwords(allTerms) : allTerms
        // sort terms if specified
        if (sortFunction) {
            return resultTerms.sort(sortFunction)
        }
        return resultTerms
    } else {
        return []
    }
}

Preprocessor.prototype.setKeyword = function (term) {
    if (this.stemmedUniqueTerms[term]) {
        this.stemmedUniqueTerms[term].isKeyword = true
        return true
    }
    return false
}

module.exports = Preprocessor