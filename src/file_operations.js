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
const { directoryExists } = require("./helpers")
const markdownGenerators = require("./markdown_generators")
const loggers = require("./loggers")
const helpers = require("./helpers")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)

const writeBoilerplate = async (outputPath, remove) => {
  if (remove) {
    console.log(`Removing the contents of ${outputPath}...`)
    await fsPromises.rmdir(outputPath, { recursive: true })
  }
  for (const file of BOILERPLATE_MARKDOWN) {
    if (!(await directoryExists(file.path))) {
      const filePath = path.join(outputPath, file.path)
      const content = `---\n${yaml.safeDump(file.content)}---\n`
      await fsPromises.mkdir(filePath, { recursive: true })
      await fsPromises.writeFile(path.join(filePath, file.name), content)
    }
  }
}

const scanCourses = async (inputPath, outputPath) => {
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

  const jsonPath = helpers.runOptions.courses
  let courseList

  if (jsonPath) {
    courseList = JSON.parse(await fsPromises.readFile(jsonPath))["courses"]
  } else {
    const courseDirectories = (await fsPromises.readdir(inputPath)).filter(
      course => !course.startsWith(".")
    )
    courseList = []
    for (const directory of courseDirectories) {
      const absPath = path.join(inputPath, directory)
      if (await directoryExists(absPath)) {
        courseList.push(directory)
      }
    }
  }
  const numCourses = courseList.length
  if (numCourses === 0) {
    console.log(NO_COURSES_FOUND_MESSAGE)
    return
  }

  // populate the course uid mapping
  const courseUidsLookup = {}
  for (const course of courseList) {
    if (!(await directoryExists(path.join(inputPath, course)))) {
      throw new Error(`Missing course directory for ${course}`)
    }

    const courseUid = await getCourseUid(inputPath, course)
    courseUidsLookup[courseUid] = course
  }

  console.log(`Converting ${numCourses} courses to Hugo markdown...`)
  const coursesPath = path.join(outputPath, "courses")
  progressBar.start(numCourses, 0)
  await Promise.all(
    courseList.map(async course => {
      console.log("\nstarting")
      await scanCourse(inputPath, coursesPath, course, courseUidsLookup)
      progressBar.increment()
    })
  )
}

const getCourseUid = async (inputPath, course) => {
  const coursePath = path.join(inputPath, course)
  const masterJsonFile = await getMasterJsonFileName(coursePath)
  if (masterJsonFile) {
    const courseData = JSON.parse(await fsPromises.readFile(masterJsonFile))
    return courseData["uid"]
  }
}

const scanCourse = async (inputPath, outputPath, course, courseUidsLookup) => {
  /*
    This function scans a course directory for a master json file and processes it
    */

  const coursePath = path.join(inputPath, course)
  const masterJsonFile = await getMasterJsonFileName(coursePath)
  if (masterJsonFile) {
    const jsonFileContents = await fsPromises.readFile(masterJsonFile)
    const courseData = JSON.parse(jsonFileContents)
    const markdownData = await markdownGenerators.generateMarkdownFromJson(
      courseData,
      courseUidsLookup
    )
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
    const contents = await fsPromises.readdir(coursePath)
    const fileName = contents.find(file => RegExp(".*_parsed.json$").test(file))
    if (fileName) {
      return path.join(coursePath, fileName)
    }
  }
  //  If we made it here, the master json file wasn't found
  const courseError = `${coursePath} - ${MISSING_COURSE_ERROR_MESSAGE}`
  if (helpers.runOptions.courses) {
    // if the script is filtering on courses, this should be a fatal error
    throw new Error(courseError)
  }

  // else, skip this one and go to the next course
  progressBar.increment()
}

const writeMarkdownFilesRecursive = async (outputPath, markdownData) => {
  /*
    For a given course identifier string and array of objects with properties
    name and data, write Hugo markdown files
    */
  for (const section of markdownData) {
    const sectionPath = path.join(outputPath, section["name"])
    await helpers.createOrOverwriteFile(sectionPath, section["data"])
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
      const filePath = path.join(outputPath, file["name"])
      await helpers.createOrOverwriteFile(filePath, file["data"])
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
