const fsPromises = require("./fsPromises")
const path = require("path")

const { directoryExists, fileExists } = require("./helpers")

const logToCsv = async (file, data) => {
  if (!(await directoryExists("reporting"))) {
    await fsPromises.mkdir("reporting")
  }
  const filePath = path.join("reporting", file)
  if (!(await fileExists(filePath))) {
    await fsPromises.writeFile(filePath, `${Object.keys(data).join(", ")}\n`)
    await fsPromises.appendFile(filePath, `${Object.values(data).join(", ")}\n`)
  } else {
    await fsPromises.appendFile(filePath, `${Object.values(data).join(", ")}\n`)
  }
}

module.exports = {
  logToCsv
}
