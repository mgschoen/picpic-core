const SVM = require('libsvm-js/asm')

let SVMClassifier = function () {
    this.model = new SVM({
        type: SVM.SVM_TYPES.C_SVC,
        kernel: SVM.KERNEL_TYPES.RBF,
        gamma: 0,
        quiet: true
    })
}

SVMClassifier.prototype.train = function (features, labels) {
    if (features.length !== labels.length) {
        throw new Error('Error training SVM model. Features and labels must have the same lenght.')
    }
    let keywordIndices = [],
        keywordFeatures = [],
        keywordLabels = [],
        regularTermsLabels = []
    labels.forEach((label,idx) => {
        if (label === 1) keywordIndices.push(idx)
    })
    for (let index of keywordIndices) {
        keywordFeatures.push(features.splice(index, 1))
        keywordLabels.push(1)
        regularTermsLabels.push(0)
    }
    let regularTermsFeatures = features.slice(0, keywordFeatures.length)
    let trainingFeatures = [...keywordFeatures, ...regularTermsFeatures]
    let trainingLabels = [...keywordLabels, ...regularTermsLabels]
    console.log(`Training SVM model with ${trainingFeatures.length} terms ...`)
    console.log(`Training set includes ${trainingLabels.filter(l => l === 1).length} keywords`)
    //let validation = this.model.crossValidation(featureSubset, labelsSubset, 10)
    this.model.train(trainingFeatures, trainingLabels)
}

SVMClassifier.prototype.predict = function (features) {
    console.log(`Predicting labels for ${features.length} terms`)
    return this.model.predict(features)
}

SVMClassifier.prototype.serialize = function () {
    return this.model.serializeModel()
}

module.exports = SVMClassifier