const winston = require("winston")

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
    })
  ]
})

module.exports = {
  fileLogger
}
