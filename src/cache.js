const fs = require("fs")
const path = require("path")
const os = require("os")
const tar = require("tar")

const { lastModifiedDate } = require("./fs_utils")
const {
  markdownDir,
  courseContentPath,
  courseContentCachePath,
  dataTemplateCachePath,
  dataTemplatePath
} = require("./paths")

const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR)
  }
}

const stale = (courseId, inputPath) => {
  ensureCacheDir()

  const courseLastModified = lastModifiedDate()
}

const saveCourseContent = async courseId => {
  ensureCacheDir()

  await tar.c(
    {
      gzip: true,
      cwd:  markdownDir(),
      file: courseContentCachePath(courseId)
    },
    [courseId]
  )
}

const loadCourseContent = async courseId => {
  await tar.x({
    cwd:  markdownDir(),
    file: courseContentCachePath(courseId)
  })
}

const saveCourseData = courseId => {
  fs.copyFileSync(dataTemplatePath(courseId), dataTemplateCachePath(courseId))
}

const loadCourseData = courseId => {}

const save = async courseId => {
  await saveCourseContent(courseId)
  await saveCourseData(courseId)
}

const load = async courseId => {}

module.exports = {
  saveCourseContent,
  saveCourseData,
  loadCourseContent,
  loadCoursedata,
  save,
  stale
}
