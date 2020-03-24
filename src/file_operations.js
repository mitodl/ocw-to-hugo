/* eslint-disable no-console */

const fsPromises = require("./fsPromises")
const path = require("path")
const stats = require("./stats")
const markdownGenerators = require("./markdown_generators")
const cliProgress = require("cli-progress")

const {
  MISSING_COURSE_ERROR_MESSAGE,
  NO_COURSES_FOUND_MESSAGE,
  BOILERPLATE_MARKDOWN,
  COURSE_TYPE,
  EMBEDDED_MEDIA_PAGE_TYPE,
  FILE_TYPE,
  PAGE_TYPE
} = require("./constants")
const { directoryExists } = require("./helpers")
const markdownGenerators = require("./markdown_generators")
const dataTemplateGenerators = require("./data_template_generators")
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
      }
    }
  }

  return { byUid: pathLookup, byCourse: courseLookup }
}

const scanCourses = (source, destination, verbose = false) => {
  /*
    This function scans the input directory for course folders
  */
  // Make sure that the source and destination arguments have been passed and they are directories
  if (!directoryExists(source)) {
    throw new Error("Invalid source directory")
  }
  if (!directoryExists(destination)) {
    throw new Error("Invalid destination directory")
  }
  // Iterate all subdirectories under source
  directoriesScanned = 0
  const contents = fs.readdirSync(source)
  const totalDirectories = contents.filter(file =>
    directoryExists(path.join(source, file))
  ).length
  if (verbose) {
    stats.init()
  }
  console.log(`Scanning ${totalDirectories} subdirectories under ${source}`)
  progressBar.start(totalDirectories, directoriesScanned)
  contents.forEach(file => {
    const coursePath = path.join(source, file)
    if (fs.lstatSync(coursePath).isDirectory()) {
      // If the item is indeed a directory, read all files in it
      scanCourse(coursePath, destination, verbose).then(() => {
        directoriesScanned++
        progressBar.update(directoriesScanned)
      })
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

const scanCourse = async (coursePath, destination, verbose = false) => {
  /*
    This function scans a course directory for a master json file and processes it
  */
  const markdownPath = path.join(outputPath, "content", "courses")
  const courseMarkdownPath = path.join(inputPath, course)
  const masterJsonFile = await getMasterJsonFileName(courseMarkdownPath)
  if (masterJsonFile) {
    const courseData = JSON.parse(await fsPromises.readFile(masterJsonFile))
    if (helpers.isCoursePublished(courseData)) {
      const markdownData = markdownGenerators.generateMarkdownFromJson(
        courseData,
        verbose
      )
      await writeMarkdownFilesRecursive(
        path.join(markdownPath, courseData["short_url"]),
        markdownData
      )
      await writeDataTemplate(
        path.join(outputPath, "data", "courses"),
        dataTemplate
      )
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

const writeSectionFiles = (section, destination) => {
  if (section.hasOwnProperty("files")) {
    section["files"].forEach(file => {
      if (file) {
        const filePath = path.join(destination, file["name"])
        const fileDirPath = path.dirname(filePath)
        if (!directoryExists(fileDirPath)) {
          fs.mkdirSync(fileDirPath, { recursive: true })
        }
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        fs.writeFileSync(filePath, file["data"])
      }
    })
  }
}

module.exports = {
  writeBoilerplate,
  scanCourses,
  scanCourse,
  getMasterJsonFileName,
  writeMarkdownFilesRecursive,
  buildPathsForAllCourses
}
