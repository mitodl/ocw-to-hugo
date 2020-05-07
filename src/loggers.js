const winston = require("winston")

const errorLogger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports: [new winston.transports.File({ filename: "ocw-to-hugo.error.log", level: "error" })]
})

module.exports = {
  errorLogger
}