const Boxen = require('boxen')
const Clui = require('clui')

const { BOXEN_OPTIONS } = require('./print.config')

const ValueList = function (title, values, options) {
    this.title = title
    this.values = values
    this.style = {
        keyWidth: options.keyWidth,
        key: options.keyStyles
    }
}

ValueList.prototype.print = function () {
    console.log(Boxen(this.title, BOXEN_OPTIONS))
    for (let block of this.values) {
        for (let item of block) {
            let valueString
            switch (item.type) {
                case 'gauge':
                    valueString = Clui.Gauge(item.value, item.max, 30, item.max, item.label)
                    break
                case 'plain':
                default:
                    valueString = `${item.value}`
            }
            new Clui.Line()
                .column(`${item.key}:`, this.style.keyWidth, this.style.key)
                .column(valueString)
                .output()
        }
        console.log()
    }
}

module.exports = ValueList