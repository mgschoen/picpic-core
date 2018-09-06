const CliGraph = require('cli-graph')
const CliColor = require('cli-color')
const Boxen = require('boxen')

const { BOXEN_OPTIONS } = require('../../config/main.config')
const charRegular = '\u{00B7}'
const charKeyword = CliColor.green.bold('O')
const captionX = 'first occurrence'
const captionY = 'term\nfrequency'

const TermPlot = function (title, coordsRegular, coordsKeywords, options) {
    this.title = title
    this.plotSize = {
        width: options.width || 50,
        height: options.height + 1 || 30
    }
    this.plot = new CliGraph({
        width: this.plotSize.width, 
        height: this.plotSize.height, 
        center: { x: 0, y: this.plotSize.height-1 }
    })
    for (let term of coordsRegular) {
        this.plot.addPoint(term.firstOccurrence * this.plotSize.width, term.termFrequency, charRegular)
    }
    for (let kw of coordsKeywords) {
        this.plot.addPoint(kw.firstOccurrence * this.plotSize.width, kw.termFrequency, charKeyword)
    }
}

TermPlot.prototype.print = function () {
    console.log(Boxen(this.title, BOXEN_OPTIONS))
    console.log(`${charRegular} = regular term, ${charKeyword} = keyword`)
    console.log()
    console.log(captionY)
    console.log(this.plot.toString())
    let whitespace = this.plotSize.width - (captionX.length / 2)
    console.log(' '.repeat(whitespace) + captionX)
    console.log()
}

module.exports = TermPlot