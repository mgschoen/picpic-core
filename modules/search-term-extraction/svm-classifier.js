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
    console.log(`Training SVM model with ${features.length} terms ...`)
    console.log(`Training set includes ${labels.filter(l => l === 1).length} keywords`)
    this.model.train(features, labels)
}

SVMClassifier.prototype.predict = function (features) {
    console.log(`Predicting labels for ${features.length} terms`)
    return this.model.predict(features)
}

SVMClassifier.prototype.serialize = function () {
    return this.model.serializeModel()
}

SVMClassifier.prototype.loadFromString = function (string) {
    let loadedSVM = SVM.load(string)
    if (loadedSVM.model) {
        this.model = loadedSVM
        return true
    }
    return false
}

module.exports = SVMClassifier