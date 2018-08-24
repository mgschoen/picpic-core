const WordPOS = require('wordpos')
WordPOS.defaults = { stopwords: false }
const Wordpos = new WordPOS()

const { 
    findOverlap, 
    isStopword, 
    stemPlainText 
} = require('../util')

class CalaisEntity {

    constructor(apiObject) {
        this.type = apiObject._type
        this.name = apiObject.name
        this.exactInstances = apiObject.instances.map(instance => instance.exact)
            .filter(instance => !isStopword(instance))
            .filter((instance, index, array) => array.indexOf(instance) === index)
        this.stemmedInstances = this.exactInstances.map(exact => stemPlainText(exact))
        this.combinedInstances = [ 
            ...this.exactInstances, 
            ...this.stemmedInstances, 
            this.name, 
            stemPlainText(this.name) 
        ]
        this.minOffset = Math.min(...apiObject.instances.map(instance => instance.offset))
        this.frequency = apiObject.instances.length
        this.containingElements = {
            'H1': false,
            'H2': false,
            'P': false,
            'LI': false,
            'OTHER': false
        }
        this.mergedTerms = []
    }

    isInstance(termObject) {
        // all terms contained in the instance candidate
        let termList = [termObject.stemmedTerm, ...termObject.originalTerms]
        // perform stemming on every original term of the candidate
        let stemmedTerms = termObject.originalTerms.map(term => stemPlainText(term))
        // ...and combine both lists
        let allTerms = [...termList, ...stemmedTerms]
        // If there is any stopword in our candidate, he is not an instance
        if (allTerms.some(isStopword)) {
            return false
        }
        for (let candidateTerm of allTerms) {
            // Is our candidate directly contained in the instances?
            if (this.combinedInstances.indexOf(candidateTerm) >= 0) {
                return true
            }
            // Is one of the instances a superterm of our candidate?
            for (let instance of this.combinedInstances) {
                if (instance.indexOf(candidateTerm) >= 0) {
                    return true
                }
            }
            // TODO: What about overlapping terms? Are they considered to be instances?
        }
        return false
    }

    overlapsWith(termObject) {
        let candidateTerms = [...termObject.originalTerms, termObject.stemmedTerm]
        for (let candidate of candidateTerms) {
            for (let instance of this.combinedInstances) {
                let overlap = findOverlap(instance, candidate)
                if (overlap.right.length > 0 || overlap.left.length > 0) {
                    return true
                }
            }
        }
        return false
    }

    merge(termObject) {
        this.mergedTerms.push(termObject)
        for (let element of termObject.containingElements) {
            if (['H1', 'H2', 'P', 'LI'].indexOf(element) < 0) {
                this.containingElements.OTHER = true
            } else {
                this.containingElements[element] = true
            }
        }
    }

    async getTermObject(fullText) {
        // prepare containing elements
        let containingElements = []
        for (let elem in this.containingElements) {
            if (this.containingElements[elem]) {
                containingElements.push(elem)
            }
        }
        // prepare original terms
        let originalTerms = [...this.exactInstances, this.name]
            .filter((instance, index, array) => array.indexOf(instance) === index)
        // prepare pos
        let pos = await Wordpos.getPOS(this.name)
        return {
            stemmedTerm: stemPlainText(this.name),
            firstOccurrence: this.minOffset / fullText.length,
            termFrequency: this.frequency,
            calaisEntityType: this.type,
            containingElements, 
            originalTerms,
            pos
        }
    }
}

module.exports = CalaisEntity