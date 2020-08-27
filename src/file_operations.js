/* eslint-disable no-console */

const fs = require("fs")
const util = require("util")
const path = require("path")
const tmp = require("tmp")
const cliProgress = require("cli-progress")
const simpleGit = require("simple-git")
const walk = require("walk")

const {
  MISSING_COURSE_ERROR_MESSAGE,
  NO_COURSES_FOUND_MESSAGE,
  HUGO_COURSE_PUBLISHER_GIT
} = require("./constants")
const { courseUidList, directoryExists } = require("./helpers")
const markdownGenerators = require("./markdown_generators")
const loggers = require("./loggers")
const helpers = require("./helpers")
const { tmpdir } = require("os")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)
const git = simpleGit()
const readdir = util.promisify(fs.readdir)

const scanCourses = (inputPath, outputPath, options = {}) => {
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
  fetchBoilerplate(outputPath, () => {
    const courseList = jsonPath
      ? JSON.parse(fs.readFileSync(jsonPath))["courses"]
      : fs.readdirSync(inputPath).filter(course => !course.startsWith("."))
    const numCourses = jsonPath
      ? courseList.length
      : courseList.filter(file => directoryExists(path.join(inputPath, file)))
        .length
    const coursesPath = path.join(outputPath, "site", "content", "courses")
    if (numCourses > 0) {
      // populate the course uid mapping
      courseList.forEach(async course => {
        const courseUid = await getCourseUid(inputPath, course)
        helpers.courseUidList[course] = courseUid
      })
      console.log(`Converting ${numCourses} courses to Hugo markdown...`)
      progressBar.start(numCourses, 0)
      courseList.forEach(course =>
        scanCourse(inputPath, coursesPath, course).then(() => {
          progressBar.increment()
        })
      )
    } else {
      console.log(NO_COURSES_FOUND_MESSAGE)
    }
  })
}

const fetchBoilerplate = (outputPath, done) => {
  const tmpDir = tmp.dirSync({
    prefix: "hugo-course-publisher"
  }).name
  git.clone(HUGO_COURSE_PUBLISHER_GIT, tmpDir).then(() => {
    const contentDir = path.join(tmpDir, "site", "content")
    const coursesDir = path.join(contentDir, "courses")
    walk.walk(tmpDir, {
      listeners: {
        file: (root, fileStats, next) => {
          if (
            (root.includes(contentDir) && !root.includes(coursesDir)) ||
            (root === coursesDir && fileStats.name === "_index.md")
          ) {
            // copy into the output path
            const outputRoot = root.replace(tmpDir, outputPath)
            if (!directoryExists(outputRoot)) {
              fs.mkdirSync(outputRoot, { recursive: true })
            }
            fs.copyFileSync(
              path.join(root, fileStats.name),
              path.join(outputRoot, fileStats.name)
            )
          }
          next()
        },
        end: () => {
          done()
        }
      }
    })
  })
}

const getCourseUid = async (inputPath, course) => {
  const coursePath = path.join(inputPath, course)
  const masterJsonFile = await getMasterJsonFileName(coursePath)
  if (masterJsonFile) {
    const courseData = JSON.parse(fs.readFileSync(masterJsonFile))
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
    const courseData = JSON.parse(fs.readFileSync(masterJsonFile))
    const markdownData = markdownGenerators.generateMarkdownFromJson(courseData)
    writeMarkdownFilesRecursive(
      path.join(outputPath, courseData["short_url"]),
      markdownData
    )
  }
}

const getMasterJsonFileName = async coursePath => {
  /*
    This function scans a course directory for a master json file and returns it
  */
  if (helpers.directoryExists(coursePath)) {
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
  throw new Error(courseError)
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
  getMasterJsonFileName,
  writeMarkdownFilesRecursive
}
