/* eslint-disable no-console */

const fsPromises = require("./fsPromises")
const path = require("path")
const yaml = require("js-yaml")
const cliProgress = require("cli-progress")

const {
  MISSING_COURSE_ERROR_MESSAGE,
  NO_COURSES_FOUND_MESSAGE,
  BOILERPLATE_MARKDOWN
} = require("./constants")
const { directoryExists, fileExists } = require("./helpers")
const markdownGenerators = require("./markdown_generators")
const loggers = require("./loggers")
const helpers = require("./helpers")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)
const { readdir, mkdir, readFile, unlink, writeFile } = fsPromises

const writeBoilerplate = async outputPath => {
  for (const file of BOILERPLATE_MARKDOWN) {
    if (!(await directoryExists(file.path))) {
      const filePath = path.join(outputPath, file.path)
      const content = `---\n${yaml.safeDump(file.content)}---\n`
      await mkdir(filePath, { recursive: true })
      await writeFile(path.join(filePath, file.name), content)
    }
  }
}

const scanCourses = async (inputPath, outputPath, options = {}) => {
  /*
    This function scans the input directory for course folders
  */
  // Make sure that the input and output arguments have been passed and they are directories
  if (!(await directoryExists(inputPath))) {
    throw new Error("Invalid input directory")
  }
  if (!(await directoryExists(outputPath))) {
    throw new Error("Invalid output directory")
  }

  const jsonPath = options.courses
  helpers.runOptions.strips3 = options.strips3
  helpers.runOptions.staticPrefix = options.staticPrefix
  const courseList = jsonPath
    ? JSON.parse(await readFile(jsonPath))["courses"]
    : (await readdir(inputPath)).filter(course => !course.startsWith("."))
  const numCourses = jsonPath
    ? courseList.length
    : Promise.all(
      courseList
        .map(file => path.join(inputPath, file))
        .map(path => directoryExists(path))
    ).length
  const coursesPath = path.join(outputPath, "courses")
  if (numCourses > 0) {
    // populate the course uid mapping
    for (const course of courseList) {
      const courseUid = await getCourseUid(inputPath, course)
      helpers.courseUidList[course] = courseUid
    }
    console.log(`Converting ${numCourses} courses to Hugo markdown...`)
    progressBar.start(numCourses, 0)
    for (const course of courseList) {
      await scanCourse(inputPath, coursesPath, course)
      progressBar.increment()
    }
  } else {
    console.log(NO_COURSES_FOUND_MESSAGE)
  }
}

const getCourseUid = async (inputPath, course) => {
  const coursePath = path.join(inputPath, course)
  const masterJsonFile = await getMasterJsonFileName(coursePath)
  if (masterJsonFile) {
    const courseData = JSON.parse(await readFile(masterJsonFile))
    return courseData["uid"]
  }
}

const scanCourse = async (inputPath, outputPath, course) => {
  /*
    This function scans a course directory for a master json file and processes it
  */

  const coursePath = path.join(inputPath, course)
  const masterJsonFile = await getMasterJsonFileName(coursePath)
  if (masterJsonFile) {
    const courseData = JSON.parse(await readFile(masterJsonFile))
    const markdownData = markdownGenerators.generateMarkdownFromJson(courseData)
    await writeMarkdownFilesRecursive(
      path.join(outputPath, courseData["short_url"]),
      markdownData
    )
  }
}

const getMasterJsonFileName = async coursePath => {
  /*
    This function scans a course directory for a master json file and returns it
  */
  if (await directoryExists(coursePath)) {
    // If the item is indeed a directory, read all files in it
    const contents = await readdir(coursePath)
    const fileName = contents.find(
      file =>
        RegExp("^[0-9a-f]{32}_master.json").test(file) || file === "master.json"
    )
    if (fileName) {
      return path.join(coursePath, fileName)
    }
  }
  //  If we made it here, the master json file wasn't found
  const courseError = `${coursePath} - ${MISSING_COURSE_ERROR_MESSAGE}`
  loggers.fileLogger.log({
    level:   "error",
    message: courseError
  })
  progressBar.increment()
}

const writeMarkdownFilesRecursive = async (outputPath, markdownData) => {
  /*
    For a given course identifier string and array of objects with properties
    name and data, write Hugo markdown files
    */
  for (const section of markdownData) {
    const sectionPath = path.join(outputPath, section["name"])
    const sectionDirPath = path.dirname(sectionPath)
    if (!(await directoryExists(sectionDirPath))) {
      await mkdir(sectionDirPath, { recursive: true })
    }
    if (await fileExists(sectionPath)) {
      await unlink(sectionPath)
    }
    await writeFile(sectionPath, section["data"])
    await writeSectionFiles("files", section, outputPath)
    await writeSectionFiles("media", section, outputPath)
    if (section.hasOwnProperty("children")) {
      await writeMarkdownFilesRecursive(outputPath, section["children"])
    }
  }
}

const writeSectionFiles = async (key, section, outputPath) => {
  if (section.hasOwnProperty(key)) {
    for (const file of section[key]) {
      try {
        const filePath = path.join(outputPath, file["name"])
        const fileDirPath = path.dirname(filePath)
        if (!(await directoryExists(fileDirPath))) {
          await mkdir(fileDirPath, { recursive: true })
        }
        if (await fileExists(filePath)) {
          await unlink(filePath)
        }
        await writeFile(filePath, file["data"])
      } catch (err) {
        loggers.fileLogger.log({
          level:   "error",
          message: err
        })
      }
    }
  }
}

module.exports = {
  writeBoilerplate,
  scanCourses,
  scanCourse,
  getMasterJsonFileName,
  writeMarkdownFilesRecursive
}
