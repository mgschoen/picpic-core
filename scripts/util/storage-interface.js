const Loki = require('lokijs')
const lfsa = require('lokijs/src/loki-fs-structured-adapter')

const REQUIRED_COLLECTIONS = ['articles', 'keywords', 'calais']

function StorageInterface () {
    this.db = null
    this.collections = {}
    for (let collectionName of REQUIRED_COLLECTIONS) {
        this.collections[collectionName] = null
    }
}

StorageInterface.prototype.init = function (pathToStorage) {
    return new Promise((resolve, reject) => {

        // init database
        let adapter = new lfsa()
        let db = new Loki(pathToStorage, {
            adapter: adapter
        })

        db.loadDatabase({}, err => {
            // generic error handling
            if (err) {
                reject(err)
                return
            }

            // check for required collections
            let missingCollections = []
            for (let collectionName of REQUIRED_COLLECTIONS) {
                let collection = db.getCollection(collectionName)
                if (!collection) {
                    missingCollections.push(collectionName)
                }
            }
            if (missingCollections.length > 0) {
                reject(new Error(`Could not find required collection(s) ${missingCollections}`))
                return
            }

            // init collections
            this.db = db
            let collectionsList = db.listCollections()
            for (let collectionMeta of collectionsList) {
                this.collections[collectionMeta.name] = db.getCollection(collectionMeta.name)
            }

            resolve()
        })
    })
}

StorageInterface.prototype.getArticle = function (id) {

    if (this.db) {

        // get article
        let dbEntry = this.collections.articles.findOne({$loki: id})
        let article = {...dbEntry}
        
        // get lead image keywords
        if (dbEntry.leadImage) {
            article.leadImage = {...dbEntry.leadImage}
            let keywords = this.getKeywords(dbEntry.leadImage.keywords)
            article.leadImage.keywords = keywords
        }

        // get calais entities
        let calais = this.getCalais(article.$loki)
        if (calais) {
            article.calais = calais
        }

        // remove unused parameters and return
        delete article.meta
        return article

    } else {
        return null
    }
}

StorageInterface.prototype.getArticleIds = function (queryObject) {
    if (this.db) {
        let query = queryObject || {}
        let articles = this.collections.articles.find(query)
        return articles.map(article => article.$loki)
    }
    return null
}

StorageInterface.prototype.getArticles = function (listOfIds) {
    if (this.db) {
        let articles = []
        for (let id of listOfIds) {
            articles.push(this.getArticle(id))
        }
        return articles
    }
    return null
}

StorageInterface.prototype.getCalais = function (forArticle) {
    if (this.db) {
        let dbCalais = this.collections.calais.findOne({forArticle: forArticle})
        if (dbCalais) {
            let calais = {...dbCalais}
            delete calais.meta
            delete calais.$loki
            delete calais.forArticle
            return calais
        }
    }
    return null
}

StorageInterface.prototype.getKeywords = function (listOfIds) {
    if (this.db) {
        let keywords = 
            this.collections.keywords.find({"$loki": { "$in": listOfIds }})
        let cleanKeywords = []
        for (let dbKeyword of keywords) {
            let kw = {...dbKeyword}
            delete kw.meta
            delete kw.$loki
            cleanKeywords.push(kw)
        }
        return cleanKeywords
    } else {
        return null
    }
}

StorageInterface.prototype.customQuery = function (collectionName, queryObject) {

    if (this.db) {
        let collection = this.collections[collectionName]
        if (collection) {
            return collection.find(queryObject)
        }
    }
    return null
}

module.exports = StorageInterface