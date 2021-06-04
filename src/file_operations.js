/* eslint-disable no-console */

const fsPromises = require("./fsPromises")
const path = require("path")
const cliProgress = require("cli-progress")

const {
  MISSING_COURSE_ERROR_MESSAGE,
  NO_COURSES_FOUND_MESSAGE,
  COURSE_TYPE,
  EMBEDDED_MEDIA_PAGE_TYPE,
  FILE_TYPE,
  PAGE_TYPE
} = require("./constants")
const { directoryExists } = require("./helpers")
const markdownGenerators = require("./markdown_generators")
const configGenerators = require("./config_generators")
const dataTemplateGenerators = require("./data_template_generators")
const helpers = require("./helpers")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)

const makeUidInfo = courseData => {
  // extract some pieces of information to populate a lookup object for use with resolveUid
  // or other places which may need a little bit of context on external items

  const types = {
    [courseData["uid"]]: { type: COURSE_TYPE }
  }
  for (const embedded of Object.values(courseData["course_embedded_media"])) {
    types[embedded["uid"]] = {
      type:      EMBEDDED_MEDIA_PAGE_TYPE,
      parentUid: embedded["parent_uid"]
    }
  }

  for (const file of courseData["course_files"]) {
    types[file["uid"]] = {
      type:         FILE_TYPE,
      fileType:     file["file_type"],
      id:           file["id"],
      parentUid:    file["parent_uid"],
      fileLocation: file["file_location"]
    }
  }

  for (const page of courseData["course_pages"]) {
    types[page["uid"]] = { type: PAGE_TYPE, parentUid: page["parent_uid"] }
  }

  return types
}

const buildPathsForAllCourses = async (inputPath, courseList) => {
  const pathLookup = {}
  const courseLookup = {}
  const masterSubjectLookup = {}

  for (const course of courseList) {
    if (!(await directoryExists(path.join(inputPath, course)))) {
      throw new Error(`Missing course directory for ${course}`)
    }
    const courseLookupList = []
    courseLookup[course] = courseLookupList

    const courseMarkdownPath = path.join(inputPath, course)
    const masterJsonFile = await getMasterJsonFileName(courseMarkdownPath)
    if (masterJsonFile) {
      const courseData = JSON.parse(await fsPromises.readFile(masterJsonFile))
      const uidInfoLookup = makeUidInfo(courseData)

      if (helpers.isCoursePublished(courseData)) {
        const coursePathLookup = helpers.buildPathsForCourse(courseData)
        for (const [uid, path] of Object.entries(coursePathLookup)) {
          const info = uidInfoLookup[uid] || {}
          const pathObj = { course, path, uid, ...info }
          pathLookup[uid] = pathObj
          courseLookupList.push(pathObj)
        }

        const courseUid = courseData["uid"]
        const courseInfo = uidInfoLookup[courseUid] || {}
        const pathObj = { course, path: "/", uid: courseUid, ...courseInfo }
        pathLookup[courseUid] = pathObj
        courseLookupList.push(pathObj)

        // If this course has master subjects defined, add this course to the lookup
        const masterSubjects = courseData["other_version_parent_uids"]
        if (masterSubjects) {
          masterSubjects.forEach(masterSubject => {
            const otherVersion = {
              course_id:     courseData["short_url"],
              course_number: `${courseData["department_number"]}.${courseData["master_course_number"]}`,
              title:         courseData["title"],
              term:          `${courseData["from_semester"]} ${courseData["from_year"]}`
            }
            masterSubjectLookup[masterSubject]
              ? masterSubjectLookup[masterSubject].push(otherVersion)
              : (masterSubjectLookup[masterSubject] = [otherVersion])
          })
        }
      }
    }
  }

  return {
    byUid:           pathLookup,
    byCourse:        courseLookup,
    byMasterSubject: masterSubjectLookup
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

  console.log(`Generating paths for ${numCourses} courses...`)
  const pathLookup = await buildPathsForAllCourses(inputPath, courseList)
  console.log(`Generated ${Object.values(pathLookup.byUid).length} paths.`)

  console.log(`Converting ${numCourses} courses to Hugo markdown...`)
  progressBar.start(numCourses, 0)
  for (const course of courseList) {
    await scanCourse(inputPath, outputPath, course, pathLookup)
    progressBar.increment()
  }
}

const scanCourse = async (inputPath, outputPath, course, pathLookup) => {
  /*
    This function scans a course directory for a master json file and processes it
  */
  const courseInputPath = path.join(inputPath, course)
  const masterJsonFile = await getMasterJsonFileName(courseInputPath)
  if (masterJsonFile) {
    const courseData = JSON.parse(await fsPromises.readFile(masterJsonFile))
    if (helpers.isCoursePublished(courseData)) {
      const markdownData = markdownGenerators.generateMarkdownFromJson(
        courseData,
        pathLookup
      )
      const dataTemplate = dataTemplateGenerators.generateDataTemplate(
        courseData,
        pathLookup
      )
      await writeMarkdownFilesRecursive(
        path.join(outputPath, courseData["short_url"], "content"),
        markdownData
      )
      await writeDataTemplate(
        path.join(outputPath, courseData["short_url"], "data"),
        dataTemplate
      )
      const configDir = path.join(
        outputPath,
        courseData["short_url"],
        "config",
        "_default"
      )
      await writeHugoConfig(configDir)
      await writeExternalLinks(configDir, courseData)
    }
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

const writeDataTemplate = async (outputPath, dataTemplate) => {
  await helpers.createOrOverwriteFile(
    path.join(outputPath, "course.json"),
    JSON.stringify(dataTemplate, null, 2)
  )
}

const writeHugoConfig = async outputPath => {
  await helpers.createOrOverwriteFile(
    path.join(outputPath, "config.yaml"),
    configGenerators.generateHugoConfig()
  )
}

const writeExternalLinks = async (outputPath, courseData) => {
  await helpers.createOrOverwriteFile(
    path.join(outputPath, "menus.yaml"),
    configGenerators.generateExternalLinksMenu(courseData)
  )
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
  scanCourses,
  scanCourse,
  getMasterJsonFileName,
  writeMarkdownFilesRecursive,
  buildPathsForAllCourses
}
