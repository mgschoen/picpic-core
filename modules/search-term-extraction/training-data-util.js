const { CALAIS_ENTITY_CATEGORIES } = require('../../config/main.config')

function scaledSigmoid (x) {
    return (1 - Math.exp(-x)) / (1 + Math.exp(-x))
}

/**
 * From a list of features and labels, select a subset
 * for training, according to a heuristic defined in `type`,
 * following the specified `options`.
 * 
 * type "slice":    Select the first n items, where n is 
 *                  specified in options.slices (default 1000)
 * type "balanced": Select a set that includes the same amount
 *                  of keywords and non-keywords. If options.slices
 *                  is specified, select at most options.slices 
 *                  items
 * @param {number[][]} features 
 * @param {number[][]} labels 
 * @param {string} type 
 * @param {object} options 
 */
function selectTrainingData (features, labels, type, options) {
    let trainingFeatures, trainingLabels, n
    switch (type) {
        case 'slice':
            n = options.slices || 1000
            trainingFeatures = features.slice(0, n)
            trainingLabels = labels.slice(0,n)
            break
        case 'balanced':
        default:
            let keywordIndices = [],
                keywordFeatures = [],
                keywordLabels = [],
                regularTermsFeatures = [],
                regularTermsLabels = []
            n = options.slices || null
            labels.forEach((label,idx) => {
                if (label === 1) keywordIndices.push(idx)
            })
            for (let index of keywordIndices) {
                keywordFeatures.push(features[index])
                keywordLabels.push(1)
                regularTermsLabels.push(0)
            }
            if (n) {
                keywordFeatures = keywordFeatures.slice(0, Math.round(n/2))
                keywordLabels = keywordLabels.slice(0, Math.round(n/2))
            }
            let index = 0
            while (regularTermsFeatures.length < keywordFeatures.length && index < features.length) {
                if (labels[index] === 0) {
                    regularTermsFeatures.push(features[index])
                }
                index++
            }
            regularTermsLabels = regularTermsLabels.slice(0, keywordLabels.length)
            trainingFeatures = [...keywordFeatures, ...regularTermsFeatures]
            trainingLabels = [...keywordLabels, ...regularTermsLabels]
    }
    return { trainingFeatures, trainingLabels }
}

function getEntityCategory (entityType) {
    for (let category in CALAIS_ENTITY_CATEGORIES) {
        if (CALAIS_ENTITY_CATEGORIES[category].indexOf(entityType) >= 0) {
            return category
        }
    }
    return 'Other'
}

function getCalaisVector (term) {
    let categories = Object.keys(CALAIS_ENTITY_CATEGORIES)
    // [ isCalaisEntity, ...CALAIS_ENTITY_CATEGORIES, Other ]
    let calaisVector = new Array(categories.length + 2).fill(0)
    if (term.calaisEntityType) {
        calaisVector[0] = 1
        let entityCategory = getEntityCategory(term.calaisEntityType)
        let categoryIndex = categories.indexOf(entityCategory)
        if (categoryIndex < 0) {
            calaisVector[calaisVector.length - 1] = 1
        } else {
            calaisVector[categoryIndex+1] = 1
        }
    }
    return calaisVector
}

module.exports = { 
    getCalaisVector,
    scaledSigmoid,
    selectTrainingData
}