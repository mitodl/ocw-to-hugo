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
    [courseData["uid"]]: {
      type:                 COURSE_TYPE,
      short_url:            courseData["short_url"],
      title:                courseData["title"],
      from_semester:        courseData["from_semester"],
      from_year:            courseData["from_year"],
      master_course_number: courseData["master_course_number"],
      department_number:    courseData["department_number"]
    }
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

async function* iterateParsedJson(inputPath, courseList) {
  for (const course of courseList) {
    if (!(await directoryExists(path.join(inputPath, course)))) {
      throw new Error(`Missing course directory for ${course}`)
    }

    const coursePath = path.join(inputPath, course)
    const masterJsonFile = await getMasterJsonFileName(coursePath)

    if (!masterJsonFile) {
      continue
    }

    const courseData = JSON.parse(await fsPromises.readFile(masterJsonFile))
    yield { course, courseData }
  }
}

const buildCoursePathLookup = async (inputPath, courseList) => {
  const courseLookup = {}
  const pathLookup = {}

  for await (const { course, courseData } of iterateParsedJson(
    inputPath,
    courseList
  )) {
    const courseLookupList = []
    courseLookup[course] = courseLookupList

    // add paths for uids found within course and include extra data which is useful for lookup purposes
    const uidInfoLookup = makeUidInfo(courseData)
    const coursePathLookup = helpers.buildPathsForCourse(courseData)
    for (const [uid, path] of Object.entries(coursePathLookup)) {
      const info = uidInfoLookup[uid] || {}
      const pathObj = { course, path, uid, ...info }
      pathLookup[uid] = pathObj
      courseLookupList.push(pathObj)
    }

    // and also do the course home page
    const courseUid = courseData["uid"]
    const courseInfo = uidInfoLookup[courseUid] || {}
    const pathObj = {
      course,
      path:      "/",
      uid:       courseUid,
      published: helpers.isCoursePublished(courseData),
      ...courseInfo
    }
    pathLookup[courseUid] = pathObj
    courseLookupList.push(pathObj)
  }

  return { pathLookup, courseLookup }
}

const buildMasterSubjectLookup = async (inputPath, courseList) => {
  const lookup = {}

  for await (const { courseData } of iterateParsedJson(inputPath, courseList)) {
    if (!helpers.isCoursePublished(courseData)) {
      continue
    }

    const courseUid = courseData["uid"]
    // If this course has master subjects defined, add this course to the lookup
    const masterSubjects = courseData["other_version_parent_uids"] || []
    for (const uid of masterSubjects) {
      if (!lookup[uid]) {
        lookup[uid] = []
      }
      lookup[uid].push(courseUid)
    }
  }

  return lookup
}

const buildArchivedParentUidLookupRecurse = (
  courseUid,
  isUpdateOfLookup,
  parentUids,
  done
) => {
  const newParentUids = (isUpdateOfLookup[courseUid] || []).filter(
    uid => !done[uid]
  )
  for (const parentUid of newParentUids) {
    parentUids.push(parentUid)
    done[parentUid] = true
  }

  for (const parentUid of newParentUids) {
    buildArchivedParentUidLookupRecurse(
      parentUid,
      isUpdateOfLookup,
      parentUids,
      done
    )
  }
}

const buildArchivedParentUidLookup = (courseUids, isUpdateOfLookup) => {
  const parentUidsLookup = {}
  for (const courseUid of courseUids) {
    const done = { [courseUid]: true }
    const parentUids = []
    buildArchivedParentUidLookupRecurse(
      courseUid,
      isUpdateOfLookup,
      parentUids,
      done
    )
    parentUidsLookup[courseUid] = parentUids
  }
  return parentUidsLookup
}

const buildArchivedLookup = async (inputPath, courseList) => {
  const dspaceLookup = {} // uid -> dspace
  const isUpdateOfLookup = {} // uid -> parent uid
  const courseUids = []

  // populate dspace lookup and initialize parent lookup
  for await (const { courseData } of iterateParsedJson(inputPath, courseList)) {
    const courseUid = courseData["uid"]
    courseUids.push(courseUid)

    const dspace = helpers.parseDspaceUrl(courseData["dspace_handle"])
    if (dspace) {
      dspaceLookup[courseUid] = dspace
    }

    isUpdateOfLookup[courseUid] = courseData["is_update_of"] || []
  }

  // uid -> list of uids, not just for the immediate parent but all the way up
  const parentUidsLookup = buildArchivedParentUidLookup(
    courseUids,
    isUpdateOfLookup
  )
  const archivedLookup = {} // course name -> list of { uid: parent course uid, dspace: reconstructed dspace link }

  for await (const { course, courseData } of iterateParsedJson(
    inputPath,
    courseList
  )) {
    const parentUids = parentUidsLookup[courseData["uid"]]
    archivedLookup[course] = []

    for (const parentUid of parentUids) {
      const dspace = dspaceLookup[parentUid]
      if (dspace) {
        archivedLookup[course].push({
          uid:       parentUid,
          dspaceUrl: `https://dspace.mit.edu/handle/${dspace}`
        })
      }
    }
  }

  return archivedLookup
}

const buildPathsForAllCourses = async (inputPath, courseList) => {
  const { pathLookup, courseLookup } = await buildCoursePathLookup(
    inputPath,
    courseList
  )
  const masterSubjectLookup = await buildMasterSubjectLookup(
    inputPath,
    courseList
  )
  const archivedLookup = await buildArchivedLookup(inputPath, courseList)

  return {
    byUid:                   pathLookup,
    byCourse:                courseLookup,
    coursesByMasterSubject:  masterSubjectLookup,
    archivedCoursesByCourse: archivedLookup
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
