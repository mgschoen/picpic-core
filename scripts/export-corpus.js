const fs = require('fs')
const ejs = require('ejs')

const Storage = require('./util/storage-interface')

const APP_ROOT = require('app-root-path')
const EXPORT_PATH = `${APP_ROOT}/data/export`

let templateFile = fs.readFileSync('./scripts/util/export-template.ejs', {encoding: 'utf8'})
let template = ejs.compile(templateFile)

let storage = new Storage()
storage.init().then(async () => {

    let articleIds = await storage.getArticleIds()
    let numArticles = articleIds.length

    for (let index in articleIds) {
        let id = articleIds[index]
        console.log(`(${index} / ${numArticles}) Exporting article ${id} ...`)
        let article = await storage.getArticle(id)
        let html = template(article)
        fs.writeFileSync(`${EXPORT_PATH}/${id}.html`, html)
    }

    process.exit(0)
}).catch(error => {
    console.error(error.message)
    process.exit(1)
})

