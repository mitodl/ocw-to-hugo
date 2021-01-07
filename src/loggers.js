const winston = require("winston")
const TransportStream = require("winston-transport")

class MemoryTransport extends TransportStream {
  constructor() {
    super()
    this.logs = []
  }

  log(info, callback) {
    // console.log(info)
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

module.exports = {
  fileLogger,
  memoryTransport
}
