const _ = require("lodash")
const path = require("path")
const moment = require("moment")

const fsPromises = require("./fsPromises")
const DEPARTMENTS_JSON = require("./departments.json")
const { AWS_REGEX, INPUT_COURSE_DATE_FORMAT } = require("./constants")
const loggers = require("./loggers")

const runOptions = {}

const distinct = (value, index, self) => {
  return self.indexOf(value) === index
}

const directoryExists = async directory => {
  try {
    return (await fsPromises.lstat(directory)).isDirectory()
  } catch (err) {
    // this will happen if we don't have access to the directory or if it doesn't exist
    return false
  }
}

const fileExists = async path => {
  try {
    return (await fsPromises.lstat(path)).isFile()
  } catch (err) {
    // this will happen if we don't have access to the file or if it doesn't exist
    return false
  }
}

const createOrOverwriteFile = async (file, body) => {
  const dirName = path.dirname(file)
  await fsPromises.mkdir(dirName, { recursive: true })
  await fsPromises.writeFile(file, body)
}

const findDepartmentByNumber = departmentNumber =>
  DEPARTMENTS_JSON.find(
    department => department["depNo"] === departmentNumber.toString()
  )

const getDepartments = courseData => {
  const primaryDepartmentNumber = courseData["department_number"]
  const department = findDepartmentByNumber(primaryDepartmentNumber)
  if (department) {
    let departments = [department["title"]]
    if (courseData["extra_course_number"]) {
      departments = departments.concat(
        courseData["extra_course_number"].map(extraCourseNumber => {
          const extraDepartmentNumber = extraCourseNumber[
            "linked_course_number_col"
          ].split(".")[0]
          const department = findDepartmentByNumber(extraDepartmentNumber)
          if (department) {
            return department["title"]
          } else return null
        })
      )
    }
    return [...new Set(departments)].filter(Boolean)
  } else return []
}

const getCourseNumbers = courseData => {
  let courseNumbers = [
    `${courseData["department_number"]}.${courseData["master_course_number"]}`
  ]
  if (courseData["extra_course_number"]) {
    courseNumbers = courseNumbers.concat(
      courseData["extra_course_number"].map(
        extraCourseNumber => extraCourseNumber["linked_course_number_col"]
      )
    )
  }
  return courseNumbers
}

const getCourseFeatureObject = courseFeature => {
  const feature = courseFeature["ocw_feature"]
  const subfeature = courseFeature["ocw_subfeature"]
  const featureObject = {}
  if (feature) {
    featureObject["feature"] = feature
  }
  if (subfeature) {
    featureObject["subfeature"] = subfeature
  }
  return featureObject
}

const getCourseSectionFromFeatureUrl = courseFeature => {
  const featureUrl = courseFeature["ocw_feature_url"]
  if (!featureUrl.includes("resolveuid")) {
    const urlParts = featureUrl.replace(/\/index.html?/g, "").split("/")
    return urlParts[urlParts.length - 1].split("#")[0]
  } else return featureUrl
}

/* eslint-disable camelcase */
const getConsolidatedTopics = courseCollections => {
  const topics = []
  const topicsLookup = {}
  const subtopicsLookup = {}
  for (const courseCollection of courseCollections) {
    const {
      ocw_feature: feature,
      ocw_subfeature: subfeature,
      ocw_speciality: speciality
    } = courseCollection

    let topicObj = topicsLookup[feature]
    if (!topicObj) {
      topicObj = {
        topic:     feature,
        subtopics: []
      }
      topics.push(topicObj)
      topicsLookup[feature] = topicObj
      subtopicsLookup[feature] = {}
    }

    if (!subfeature) {
      continue
    }

    let subtopicObj = subtopicsLookup[feature][subfeature]
    if (!subtopicObj) {
      subtopicObj = {
        subtopic:     subfeature,
        specialities: []
      }
      topicObj.subtopics.push(subtopicObj)
      subtopicsLookup[feature][subfeature] = subtopicObj
    }

    if (speciality) {
      subtopicObj.specialities.push(speciality)
    }
  }
  return topics
}
/* eslint-disable camelcase */

const getYoutubeEmbedCode = media => {
  const youTubeMedia = media["embedded_media"].filter(embeddedMedia => {
    return embeddedMedia["id"] === "Video-YouTube-Stream"
  })
  return youTubeMedia
    .map(embeddedMedia => `{{< youtube ${embeddedMedia["media_location"]} >}}`)
    .join("")
}

const buildPathRecursive = (item, itemsLookup, courseUid, pathLookup) => {
  const { filenameKey, page } = item
  const uid = page["uid"]
  const parentUid = page["parent_uid"]
  const parentItem = itemsLookup[parentUid]

  if (courseUid === parentUid) {
    // course is the parent, so link should be off of /sections
    const filename = page[filenameKey]
    pathLookup[uid] = path.join(runOptions.linkPrefix, "sections", filename)
    return
  }

  if (!parentItem) {
    loggers.fileLogger.error(`Missing parent ${parentUid}`)
    return
  }

  if (!pathLookup[parentUid]) {
    buildPathRecursive(parentItem, itemsLookup, courseUid, pathLookup)
    if (!pathLookup[parentUid]) {
      throw new Error(`Unable to find path for ${parentUid}`)
    }
  }

  pathLookup[uid] = path.join(pathLookup[parentUid], page[filenameKey])
}

const buildPaths = courseData => {
  const courseUid = courseData["uid"]
  const pathLookup = {}
  const itemsLookup = {}

  for (const page of courseData["course_pages"]) {
    itemsLookup[page["uid"]] = { filenameKey: "short_url", page: page }
  }
  for (const page of Object.values(courseData["course_embedded_media"])) {
    itemsLookup[page["uid"]] = {
      filenameKey: "short_url",
      page
    }
  }
  for (const page of courseData["course_files"]) {
    itemsLookup[page["uid"]] = {
      filenameKey: "id",
      page
    }
  }

  for (const item of Object.values(itemsLookup)) {
    buildPathRecursive(item, itemsLookup, courseUid, pathLookup)
  }

  return pathLookup
}

const applyReplacements = (matchAndReplacements, text) => {
  const sortedMatchAndReplacements = Array.from(matchAndReplacements)
  // this sorts in reverse order with highest index first so that we can do replacements
  // without needing to adjust indexes for the next items to be processed
  sortedMatchAndReplacements.sort((a, b) => {
    if (a.match.index < b.match.index) {
      return 1
    } else if (a.match.index > b.match.index) {
      return -1
    }
    return 0
  })

  for (const { match, replacement } of sortedMatchAndReplacements) {
    text = replaceSubstring(text, match.index, match[0].length, replacement)
  }

  return text
}

const resolveUidForLink = (url, courseData, courseUidsLookup, pathLookup) => {
  const urlParts = url.split("/")
  const uid = urlParts[urlParts.length - 1]
  // filter course_pages on the UID in the URL
  const linkedPage = courseData["course_pages"].find(
    coursePage => coursePage["uid"] === uid
  )
  // filter course_files on the UID in the URL
  const linkedFile = courseData["course_files"].find(
    file => file["uid"] === uid
  )
  const linkedCourse = courseUidsLookup[uid]
  if (linkedPage) {
    // a page has been found for this UID
    return pathLookup[uid] || null
  } else if (linkedFile) {
    // a course_file has been found for this UID
    const parentUid = linkedFile["parent_uid"]

    if (linkedFile["file_type"] === "application/pdf") {
      // create a link to the generated PDF viewer page for this PDF file
      const parent = pathLookup[parentUid]
      if (parent) {
        const pdfPath = path.join(parent, linkedFile["id"])
        return stripPdfSuffix(pdfPath)
      }
    } else {
      // link directly to the static content
      return stripS3(linkedFile["file_location"])
    }
  } else if (linkedCourse) {
    return pathLookup[linkedCourse["uid"]]
  }

  return null
}

/**
 * @param {string} htmlStr
 * @param {object} page
 * @param {object} courseData
 * @param {object} courseUidsLookup
 * @param {object} pathLookup
 *
 * The purpose of this function is to resolve "resolveuid" links in OCW HTML.
 * It takes 5 parameters; an HTML string to parse, the page that the string came from,
 * the course data object, a lookup from uid to course, and a lookup from uid to path.
 *
 */
const resolveUidMatches = (
  htmlStr,
  page,
  courseData,
  courseUidsLookup,
  pathLookup
) => {
  try {
    /**
     * resolveuid links are formatted as, for example:
     *
     * href="./resolveuid/b463875b69d4156b90faaeb0dd7ca66b"
     *
     * the UID is the only part we need, so we split the string on "/" and
     * take the last part
     */
    const matches = Array.from(htmlStr.matchAll(/\.?\/?resolveuid\/.{0,32}/g))

    return matches
      .map(match => {
        const replacement = resolveUidForLink(
          match[0],
          courseData,
          courseUidsLookup,
          pathLookup
        )
        if (replacement !== null) {
          return {
            match,
            replacement
          }
        }
        return null
      })
      .filter(Boolean)
  } catch (err) {
    loggers.fileLogger.error(err)
  }
  return []
}

const resolveRelativeLink = (url, courseData) => {
  // ensure that this is not resolveuid or an external link
  if (!url.includes("resolveuid") && url[0] === "/") {
    // split the url into its parts
    const parts = url.split("/").filter(part => part !== "")
    /**
     * disassembles the OCW URL based on the following patten:
     *
     * EXAMPLE: /courses/mathematics/18-01-single-variable-calculus-fall-2006/exams/prfinalsol.pdf
     *
     * 0: "courses"
     * 1: department ("mathematics")
     * 2: course ID ("18-01-single-variable-calculus-fall-2006")
     * 3 - ?: section and subsections with the page / file at the end
     */
    const courseId = parts[2]
    if (courseId) {
      const layers = parts.length - 3
      let sections = []
      let page = null
      if (layers === 0) {
        // course home page link
        page = "index.htm"
      } else if (layers === 1) {
        // root section link
        page = parts[3]
      } else {
        // this is a link to something in a subsection, slice out the layers and page
        sections = parts.slice(parts.length - layers, parts.length - 1)
        page = parts.slice(parts.length - 1, parts.length)[0]
      }
      // build the base of the Hugo url
      const newUrlBase = path.join(
        runOptions.linkPrefix,
        "sections",
        ...sections
      )
      if (page.includes(".") && !page.includes(".htm")) {
        // page has a file extension and isn't HTML
        for (const media of courseData["course_files"]) {
          if (media["file_location"]) {
            if (
              media["file_type"] === "application/pdf" &&
              media["file_location"].includes(page)
            ) {
              // construct url to Hugo PDF viewer page
              return path.join(newUrlBase, stripPdfSuffix(page))
            } else if (media["file_location"].includes(page)) {
              // write link directly to file
              return stripS3(media["file_location"])
            }
          }
        }
      } else {
        // match page from url to the short_url property on a course page
        for (const coursePage of courseData["course_pages"]) {
          if (coursePage["short_url"].toLowerCase() === page.toLowerCase()) {
            const pageName = page.replace(/(index)?\.html?/g, "")

            return path.join(newUrlBase, pageName)
          }
        }
      }
    }
  }

  return null
}

/**
 * @param {string} htmlStr
 * @param {object} courseData
 *
 * The purpose of this function is to find relatively linked content
 * in a given HTML string and try to resolve that URL to the static content
 * or course section it is supposed to point to.
 *
 */
const resolveRelativeLinkMatches = (htmlStr, courseData) => {
  try {
    // find and iterate all href tags
    const matches = Array.from(
      htmlStr.matchAll(/((href="(?<url1>[^"]*)")|(href='(?<url2>[^']*)'))/g)
    )
    return matches
      .map(match => {
        const url = match.groups.url1 || match.groups.url2

        const replacement = resolveRelativeLink(url, courseData)
        if (replacement !== null) {
          return { match, replacement: `href="${replacement}"` }
        }
        return null
      })
      .filter(Boolean)
  } catch (err) {
    loggers.fileLogger.error(err)
  }
  return []
}

const resolveYouTubeEmbedMatches = (htmlStr, courseData) => {
  return Object.keys(courseData["course_embedded_media"])
    .map(key => {
      const index = htmlStr.indexOf(key)
      if (index !== -1) {
        // match is meant to resemble a regex match object enough
        // to be used with applyReplacements above
        const match = [key]
        match.index = index
        const replacement = getYoutubeEmbedCode(
          courseData["course_embedded_media"][key]
        )
        return { replacement, match }
      }
      return null
    })
    .filter(Boolean)
}

const htmlSafeText = text =>
  text.replace(/("|')/g, "").replace(/(\r\n|\r|\n)/g, " ")

const stripS3 = text => {
  if (runOptions.strips3) {
    const staticPrefix = runOptions.staticPrefix ? runOptions.staticPrefix : ""
    return text.replace(AWS_REGEX, staticPrefix)
  } else return text
}

const escapeDoubleQuotes = text => text.replace(/"/g, "&quot;")

const unescapeBackticks = text => text.replace(/\\`/g, "&grave;")

const isCoursePublished = courseData => {
  const lastPublishedToProduction = moment(
    courseData["last_published_to_production"],
    INPUT_COURSE_DATE_FORMAT
  )
  const lastUnpublishingDate = moment(
    courseData["last_unpublishing_date"],
    INPUT_COURSE_DATE_FORMAT
  )
  if (
    !courseData["last_published_to_production"] ||
    lastUnpublishingDate.isAfter(lastPublishedToProduction)
  ) {
    return false
  } else return true
}

const stripSuffix = suffix => text => {
  if (text.toLowerCase().endsWith(suffix.toLowerCase())) {
    return text.slice(0, -suffix.length)
  }
  return text
}

const stripPdfSuffix = stripSuffix(".pdf")

const replaceSubstring = (text, index, length, substring) =>
  `${text.substring(0, index)}${substring}${text.substring(index + length)}`

module.exports = {
  distinct,
  directoryExists,
  createOrOverwriteFile,
  fileExists,
  findDepartmentByNumber,
  getDepartments,
  getCourseNumbers,
  getCourseFeatureObject,
  getCourseSectionFromFeatureUrl,
  getConsolidatedTopics,
  getYoutubeEmbedCode,
  resolveUidMatches,
  resolveRelativeLinkMatches,
  resolveYouTubeEmbedMatches,
  buildPaths,
  htmlSafeText,
  stripS3,
  escapeDoubleQuotes,
  unescapeBackticks,
  isCoursePublished,
  runOptions,
  stripPdfSuffix,
  replaceSubstring,
  applyReplacements
}
