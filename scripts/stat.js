// Libraries
const RestClient = require('node-rest-client').Client

// Instances
const rest = new RestClient()

// Modules
const Preprocessor = require('../modules/preprocessor')

// Script
rest.get('http://picpic-api.argonn.me/article/412', (data, response) => {
    
    let paragraphs = data.article.paragraphs
    paragraphs.unshift({
        type: 'H1',
        content: data.article.headline
    })

    let preprocessor = new Preprocessor(paragraphs)
    preprocessor.preprocess()

    console.log('# # # Article full text:')
    console.log(preprocessor.fullText)
    console.log()
    console.log('# # # Article stemmed:')
    console.log(preprocessor.fullTextStemmed)
    console.log()
    console.log('# # # All terms:')
    console.log(preprocessor.allTerms)

})