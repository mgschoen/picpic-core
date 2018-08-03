// Libraries
const RestClient = require('node-rest-client').Client

// Instances
const rest = new RestClient()

// Modules
const Preprocessor = require('../modules/preprocessor')

// Script
rest.get('http://picpic-api.argonn.me/article/412', async (data, response) => {
    
    let paragraphs = data.article.paragraphs
    paragraphs.unshift({
        type: 'H1',
        content: data.article.headline
    })

    let preprocessor = new Preprocessor(paragraphs)
    await preprocessor.preprocess()

    console.log(preprocessor.allTerms)

})