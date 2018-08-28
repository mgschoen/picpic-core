const { MongoClient, ObjectId } = require('mongodb')

const REQUIRED_COLLECTIONS = ['articles', 'keywords', 'calais']

function validateId (id) {
    let queryId = null
    if (typeof id === 'string') {
        try {
            queryId = ObjectId(id)
        } catch (error) {
            console.error(error.message)
            return null
        }
    } else if (id instanceof ObjectId) {
        queryId = id
    } else {
        console.error(`Invalid argument id: ${id} (must be of type 'string' or instance of ObjectId)`)
        return null
    }
    return queryId
}

function StorageInterface () {
    this.db = null
    this.ready = false
    this.collections = {}
    for (let collectionName of REQUIRED_COLLECTIONS) {
        this.collections[collectionName] = null
    }
}

StorageInterface.prototype.init = async function (host, port, db) {

    let HOST = host || 'localhost'
    let PORT = port || 27017
    let DB = db || 'picpic'

    let connectionString = `mongodb://${HOST}:${PORT}/${DB}`
    let client = await MongoClient.connect(connectionString, {useNewUrlParser: true})
    this.db = client.db()
    for (let collectionName of REQUIRED_COLLECTIONS) {
        let collection = await this.db.collection(collectionName)
        if (collection) {
            this.collections[collectionName] = collection
        } else {
            this.collections[collectionName] = await this.db.createCollection(collectionName)
        }
    }
    this.ready = true
}

StorageInterface.prototype.getArticle = async function (id) {

    if (this.ready) {

        // get article
        let queryId = validateId(id)
        let article = await this.collections.articles.findOne({_id: queryId})
        
        // get lead image keywords
        if (article.leadImage) {
            let keywords = await this.getKeywords(article.leadImage.keywords)
            article.leadImage.keywords = keywords
        }

        // get calais entities
        let calais = await this.getCalais(id)
        if (calais) {
            article.calais = calais
        }

        return article

    } else {
        throw new Error('DB not initialised. Call StorageInterface.init() first')
    }
}

StorageInterface.prototype.getArticleIds = async function (queryObject) {
    if (this.ready) {
        let query = queryObject || {}
        let articles = await this.collections.articles.find(query)
        return await articles.map(article => article._id.toString()).toArray()
    } else {
        throw new Error('DB not initialised. Call StorageInterface.init() first')
    }
}

StorageInterface.prototype.getArticles = async function (listOfIds) {
    if (this.ready) {
        let articles = []
        for (let id of listOfIds) {
            articles.push(await this.getArticle(id))
        }
        return articles
    } else {
        throw new Error('DB not initialised. Call StorageInterface.init() first')
    }
}

StorageInterface.prototype.getCalais = async function (forArticle) {
    if (this.ready) {
        let queryId = forArticle
        if (typeof queryId !== 'string') {
            queryId = queryId.toString()
        }
        let calais = await this.collections.calais.findOne({forArticle: queryId})
        if (calais) {
            delete calais._id
            delete calais.forArticle
            return calais
        } else {
            return null
        }
    } else {
        throw new Error('DB not initialised. Call StorageInterface.init() first')
    }
}

StorageInterface.prototype.getKeywords = async function (listOfIds) {
    if (this.ready) {
        let objectIds = listOfIds.map(id => validateId(id))
        let keywords = await this.collections.keywords
            .find({_id: { $in: objectIds }})
            .map(kw => {
                delete kw._id
                return kw
            })
            .toArray()
        return keywords
    } else {
        throw new Error('DB not initialised. Call StorageInterface.init() first')
    }
}

StorageInterface.prototype.customQuery = async function (collectionName, queryObject) {

    if (this.ready) {
        let collection = this.collections[collectionName]
        if (collection) {
            return await collection.find(queryObject).toArray()
        } else {
            throw new Error(`Collection "${collectionName}" does not exist`)
        }
    } else {
        throw new Error('DB not initialised. Call StorageInterface.init() first')
    }
}

module.exports = StorageInterface