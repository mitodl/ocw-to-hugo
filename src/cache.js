const fs = require("fs")
const path = require("path")
const os = require("os")
const tar = require("tar")

const { lastModifiedDate, fileExists, ensureDirnameExists } = require("./fs_utils")
const {
  markdownDir,
  courseContentPath,
  courseContentCachePath,
  dataTemplateCachePath,
  dataTemplatePath,
  CACHE_DIR
} = require("./paths")

const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR)
  }
}

const stale = async (courseId, inputPath) => {
  ensureCacheDir()

  const haveCacheEntry = await fileExists(courseContentCachePath(courseId))

  if (!haveCacheEntry) {
    console.log(`${courseId} is missing`);
    return true
  }

  const courseLastModified = lastModifiedDate(inputPath)
  const cacheLastModified = fs.statSync(
    courseContentCachePath(courseId)
  ).mtime

  const stale = courseLastModified > cacheLastModified
  if (stale) {
    console.log(`${courseId} cache miss`);
  }  else {
    console.log(`${courseId} cache hit`);
  }
  return stale
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

// fix these later
const saveCourseData = async courseId => {
  fs.copyFileSync(dataTemplatePath(courseId), dataTemplateCachePath(courseId))
}

const loadCourseData = async courseId => {
  await ensureDirnameExists(dataTemplatePath(courseId))
  fs.copyFileSync(dataTemplateCachePath(courseId), dataTemplatePath(courseId))
}

const save = async courseId => {
  await saveCourseContent(courseId)
  await saveCourseData(courseId)
}

const load = async courseId => {
  await loadCourseContent(courseId)
  await loadCourseData(courseId)
}

module.exports = {
  saveCourseContent,
  saveCourseData,
  loadCourseContent,
  loadCourseData,
  save,
  load,
  stale
}
