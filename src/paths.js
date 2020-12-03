const path = require("path")
const os = require("os")

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

module.exports = {
  markdownDir,
  courseContentPath,
  dataTemplateDir,
  dataTemplatePath,
  CACHE_DIR,
  courseContentCachePath,
  dataTemplateCachePath
}
