const ArticlePreprocessor = require('./modules/preprocessor/pp-article')
const KeywordsPreprocessor = require('./modules/preprocessor/pp-keywords')
const Matcher = require('./modules/training/matcher')
const StatisticalSearchTermExtractor = require('./modules/search-term-extraction/ste-statistical')

module.exports = {
    ArticlePreprocessor,
    KeywordsPreprocessor,
    Matcher,
    StatisticalSearchTermExtractor
}