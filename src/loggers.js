const fs = require("fs")
const winston = require("winston")
const TransportStream = require("winston-transport")

const helpers = require("./helpers")

class MemoryTransport extends TransportStream {
  constructor() {
    super()
    this.logs = []
  }

  log(info, callback) {
    this.logs.push(info)
    callback()
  }
}

const memoryTransport = new MemoryTransport()

const fileLogger = winston.createLogger({
  level:       "error",
  format:      winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports:  [
    new winston.transports.File({
      filename: "ocw-to-hugo.error.log",
      level:    "error"
    }),
    new winston.transports.File({
      filename: "ocw-to-hugo.info.log",
      level:    "info"
    }),
    memoryTransport
  ]
})

const statsLogger = class {
  constructor(fileName) {
    this.fileName = fileName
    fs.appendFileSync(
      this.fileName,
      `${new Date().toLocaleString()} - ${
        helpers.stats.courseIds.length
      } courses\n`
    )
  }

  writeCourseTitleStats() {
    const ordered = helpers.stats.courseTitleLengths.sort(function(a, b) {
      return a.length - b.length
    })
    const total = ordered.length
    const shortest = ordered[0]
    const median = helpers.median(ordered)
    const longest = ordered[total - 1]
    fs.appendFileSync(
      this.fileName,
      `Shortest course title: ${shortest.length} - ${shortest.course_id}\n`
    )
    fs.appendFileSync(
      this.fileName,
      `Median course title length: ${median.length} - ${median.course_id}\n`
    )
    fs.appendFileSync(
      this.fileName,
      `Longest course title: ${longest.length} - ${longest.course_id}\n`
    )
  }
}

module.exports = {
  fileLogger,
  statsLogger,
  memoryTransport
}
