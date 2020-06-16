/* eslint-disable no-console */

const fs = require("fs")
const util = require("util")
const path = require("path")
const cliProgress = require("cli-progress")

const {
  MISSING_COURSE_ERROR_MESSAGE,
  NO_COURSES_FOUND_MESSAGE
} = require("./constants")
const { directoryExists } = require("./helpers")
const markdownGenerators = require("./markdown_generators")
const loggers = require("./loggers")
const helpers = require("./helpers")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)
const readdir = util.promisify(fs.readdir)

const scanCourses = (inputPath, outputPath, jsonPath = null) => {
  /*
    This function scans the input directory for course folders
  */
  // Make sure that the input and output arguments have been passed and they are directories
  if (!directoryExists(inputPath)) {
    throw new Error("Invalid input directory")
  }
  if (!directoryExists(outputPath)) {
    throw new Error("Invalid output directory")
  }
  if (jsonPath) {
    // Iterate only the courses specified in the coursesJson
    const coursesJson = JSON.parse(fs.readFileSync(jsonPath))
    const totalCourses = coursesJson["courses"].length
    if (totalCourses > 0) {
      console.log(`Converting ${totalCourses} courses to Hugo markdown...`)
      progressBar.start(totalCourses, 0)
      coursesJson["courses"].forEach(course =>
        scanCourse(inputPath, outputPath, course).then(() => {
          progressBar.increment()
        })
      )
    } else {
      console.log(NO_COURSES_FOUND_MESSAGE)
    }
  } else {
    // Iterate all subdirectories under input
    const contents = fs.readdirSync(inputPath)
    const totalDirectories = contents.filter(file =>
      directoryExists(path.join(inputPath, file))
    ).length
    if (totalDirectories > 0) {
      console.log(`Converting ${totalDirectories} courses to Hugo markdown...`)
      progressBar.start(totalDirectories, 0)
      contents.forEach(course =>
        scanCourse(inputPath, outputPath, course).then(() => {
          progressBar.increment()
        })
      )
    } else {
      console.log(NO_COURSES_FOUND_MESSAGE)
    }
  }
}

const scanCourse = async (inputPath, outputPath, course) => {
  /*
    This function scans a course directory for a master json file and processes it
  */
  const coursePath = path.join(inputPath, course)
  if (fs.lstatSync(coursePath).isDirectory()) {
    if (helpers.directoryExists(coursePath)) {
      // If the item is indeed a directory, read all files in it
      const contents = await readdir(coursePath)
      for (const file of contents) {
        // If the item is a master json file, parse it and process into hugo markdown
        if (
          RegExp("^[0-9a-f]{32}_master.json").test(file) ||
          file == "master.json"
        ) {
          const courseData = JSON.parse(
            fs.readFileSync(path.join(coursePath, file))
          )
          const markdownData = markdownGenerators.generateMarkdownFromJson(
            courseData
          )
          writeMarkdownFilesRecursive(
            path.join(outputPath, courseData["short_url"]),
            markdownData
          )
        }
      }
    } else {
      const courseError = `${coursePath} - ${MISSING_COURSE_ERROR_MESSAGE}`
      loggers.fileLogger.log({
        level:   "error",
        message: courseError
      })
      progressBar.increment()
      throw new Error(courseError)
    }
  }
}

const writeMarkdownFilesRecursive = (outputPath, markdownData) => {
  /*
    For a given course identifier string and array of objects with properties
    name and data, write Hugo markdown files
    */
  for (const section of markdownData) {
    const sectionPath = path.join(outputPath, section["name"])
    const sectionDirPath = path.dirname(sectionPath)
    if (!directoryExists(sectionDirPath)) {
      fs.mkdirSync(sectionDirPath, { recursive: true })
    }
    if (fs.existsSync(sectionPath)) {
      fs.unlinkSync(sectionPath)
    }
    fs.writeFileSync(sectionPath, section["data"])
    writeSectionFiles("files", section, outputPath)
    writeSectionFiles("media", section, outputPath)
    if (section.hasOwnProperty("children")) {
      writeMarkdownFilesRecursive(outputPath, section["children"])
    }
  }
}

const writeSectionFiles = (key, section, outputPath) => {
  if (section.hasOwnProperty(key)) {
    section[key].forEach(file => {
      try {
        const filePath = path.join(outputPath, file["name"])
        const fileDirPath = path.dirname(filePath)
        if (!directoryExists(fileDirPath)) {
          fs.mkdirSync(fileDirPath, { recursive: true })
        }
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        fs.writeFileSync(filePath, file["data"])
      } catch (err) {
        loggers.fileLogger.log({
          level:   "error",
          message: err
        })
      }
    })
  }
}

module.exports = {
  scanCourses,
  scanCourse,
  writeMarkdownFilesRecursive
}
