const ArticlePreprocessor = require('./modules/preprocessor/pp-article')
const KeywordsPreprocessor = require('./modules/preprocessor/pp-keywords')
const Matcher = require('./modules/training/matcher')

module.exports = {
    ArticlePreprocessor, KeywordsPreprocessor, Matcher
}