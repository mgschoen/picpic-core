const Table = require('cli-table')
const Boxen = require('boxen')
const Clui = require('clui')

const { BOXEN_OPTIONS } = require('./print.config')
const { concatStrings } = require('../util')

const TermTable = function (data) {
    this.table = new Table({
        head: [
            'term (stemmed)',
            'terms (article)',
            'terms (KW)',
            'tf', 
            'fo', 
            'paragraph types',
            'POS (n-v-adj-adv-r)',
            'entity type',
            'kw type'
        ]
    })
    for (let row of data) {
        this.table.push([
            row.termStemmed,
            concatStrings(row.termsArticle, '\n'),
            concatStrings(row.termsKeyword, '\n'),
            row.termFrequency,
            Clui.Gauge(row.firstOccurrence, 1, 20, 1,
                `${Math.round(row.firstOccurrence * 10000) / 100}%`),
            concatStrings(row.paragraphTypes),
            `${row.pos.nouns.length} - ${row.pos.verbs.length} - ${row.pos.adjectives.length} - `+ 
                `${row.pos.adverbs.length} - ${row.pos.rest.length}`,
            row.entityType,
            row.keywordType
        ])
    }
}

TermTable.prototype.print = function () {
    console.log(Boxen('Matched terms', BOXEN_OPTIONS))
    console.log(this.table.toString())
}

module.exports = TermTable