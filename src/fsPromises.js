const fs = require("fs").promises

const withStackTrace = fn => async (...args) => {
  let error
  try {
    // Create stack trace here. fs functions don't have stack traces by default for performance,
    // but they are very useful for error handling.
    error = new Error()
    return await fn(...args)
  } catch (err) {
    error.message = err
    throw error
  }
}

const _exports = {}
for (const key of Object.keys(fs)) {
  _exports[key] = withStackTrace(fs[key])
}
module.exports = _exports
