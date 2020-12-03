const fs = require("fs")
const path = require("path")
const os = require("os")
const tar = require("tar")

const { lastModifiedDate } = require("./fs_utils")

const cacheDirectory = () => path.resolve(os.homedir(), ".cache", "ocw-to-hugo")

const CACHE_DIR = cacheDirectory()

const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR)
  }
}

const courseContentCachePath = courseKey =>
  path.resolve(CACHE_DIR, `${courseKey}_markdown.tgz`)

const saveCourseContent = async (markdownPath, courseKey) => {
  ensureCacheDir()

  await tar.c(
    {
      gzip: true,
      C:    markdownPath,
      file: courseContentCachePath(courseKey)
    },
    [courseKey]
  )
}

const loadCourseContent = (markdownPath, courseKey) => {
  fs.createReadStream(courseContentCachePath(courseKey)).pipe(
    tar.x({
      C: markdownPath // alias for cwd:'some-dir', also ok
    })
  )
}

const dataTemplateCachePath = courseKey =>
  path.resolve(CACHE_DIR, `${courseKey}.json`)

const saveCourseData = (dataTemplatePath, courseKey) => {
  fs.copyFileSync(dataTemplatePath, dataTemplateCachePath(courseKey))
}

module.exports = { saveCourseContent, saveCourseData, loadCourseContent }
