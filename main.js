const ArticlePreprocessor = require('./modules/preprocessor/pp-article')
const KeywordsPreprocessor = require('./modules/preprocessor/pp-keywords')
const Matcher = require('./modules/training/matcher')
const StatisticalSearchTermExtractor = require('./modules/search-term-extraction/ste-statistical')
const LearningSearchTermExtractor = require('./modules/search-term-extraction/ste-learning')

module.exports = {
    ArticlePreprocessor,
    KeywordsPreprocessor,
    Matcher,
    StatisticalSearchTermExtractor,
    LearningSearchTermExtractor
}