const path = require("path")
const os = require("os")
const fsPromises = require("./fsPromises")
const { directoryExists, isDirectory } = require("./fs_utils")
const fs = require("fs")

const helpers = require("./helpers")

const markdownDir = () =>
  path.join(helpers.runOptions.output, "content", "courses")

const courseContentPath = courseId => path.join(markdownDir(), courseId)

const dataTemplateDir = () => path.join(helpers.runOptions.output, "data", "courses")

const dataTemplatePath = courseId =>
  path.join(dataTemplateDir(), `${courseId}.json`)

const cacheDirectory = () => path.resolve(os.homedir(), ".cache", "ocw-to-hugo")
const CACHE_DIR = cacheDirectory()

const courseContentCachePath = courseKey =>
  path.resolve(CACHE_DIR, `${courseKey}_markdown.tgz`)

const dataTemplateCachePath = courseId =>
  path.resolve(CACHE_DIR, `${courseId}.json`)

const parsed_regex = /.*_parsed.json$/
const getMasterJsonFileName = async coursePath => {
  /*
    This function scans a course directory for a master json file and returns it
  */
  if (await directoryExists(coursePath)) {
  // if (isDirectory(coursePath)) {
    // If the item is indeed a directory, read all files in it
    const contents = await fsPromises.readdir(coursePath)
    // const contents = fs.readdirSync(coursePath)
    const fileName = contents.find(file => parsed_regex.test(file))
    if (fileName) {
      return path.join(coursePath, fileName)
    }
  }
}

module.exports = {
  markdownDir,
  courseContentPath,
  dataTemplateDir,
  dataTemplatePath,
  CACHE_DIR,
  courseContentCachePath,
  dataTemplateCachePath,
  getMasterJsonFileName
}
