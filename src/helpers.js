const _ = require("lodash")
const path = require("path")
const moment = require("moment")

const fsPromises = require("./fsPromises")
const DEPARTMENTS_JSON = require("./departments.json")
const {
  AWS_REGEX,
  GETPAGESHORTCODESTART,
  GETPAGESHORTCODEEND,
  INPUT_COURSE_DATE_FORMAT
} = require("./constants")
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

const pathToChildRecursive = (basePath, child, courseData) => {
  const parents = courseData["course_pages"].filter(
    page =>
      page["uid"] === child["parent_uid"] &&
      courseData["uid"] !== child["parent_uid"]
  )
  if (parents.length > 0) {
    return path.join(
      basePath,
      pathToChildRecursive("", parents[0], courseData),
      child["short_url"]
    )
  } else return path.join(basePath, child["short_url"])
}

const getHugoPathSuffix = (page, courseData) => {
  const children = courseData["course_pages"].filter(
    coursePage => coursePage["parent_uid"] === page["uid"]
  )
  const files = courseData["course_files"].filter(
    file => file["parent_uid"] === page["uid"]
  )
  const isParent = children.length > 0
  const hasFiles = files.length > 0
  return isParent || hasFiles ? "/_index.md" : ""
}

const resolveUidForLink = (url, courseData, courseUidsLookup, pagePath) => {
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
    // a course_page has been found for this UID
    const linkPagePath = `${pathToChildRecursive(
      path.join("courses", courseData["short_url"], "sections"),
      linkedPage,
      courseData
    )}${getHugoPathSuffix(linkedPage, courseData)}`
    return `${GETPAGESHORTCODESTART}${linkPagePath}${GETPAGESHORTCODEEND}`
  } else if (linkedFile) {
    // a course_file has been found for this UID
    if (linkedFile["file_type"] === "application/pdf") {
      // create a link to the generated PDF viewer page for this PDF file
      const pdfPath = `${pagePath.replace("/_index.md", "/")}${
        linkedFile["id"]
      }`
      return `${GETPAGESHORTCODESTART}${stripPdfSuffix(
        pdfPath
      )}${GETPAGESHORTCODEEND}`
    } else {
      // link directly to the static content
      return stripS3(linkedFile["file_location"])
    }
  } else if (linkedCourse) {
    return `/courses/${linkedCourse}`
  }

  return url
}

/**
 * @param {string} htmlStr
 * @param {object} page
 * @param {object} courseData
 * @param {object} courseUidsLookup
 *
 * The purpose of this function is to resolve "resolveuid" links in OCW HTML.
 * It takes 4 parameters; an HTML string to parse, the page that the string came from,
 * the course data object, and a lookup from uid to course.
 *
 */
const resolveUids = (htmlStr, page, courseData, courseUidsLookup) => {
  try {
    // get the Hugo path to the page
    const pagePath = `${pathToChildRecursive(
      path.join("courses", courseData["short_url"], "sections"),
      page,
      courseData
    )}${getHugoPathSuffix(page, courseData)}`
    // iterate all resolveuid links by regex match
    const matches = Array.from(htmlStr.matchAll(/\.?\/?resolveuid\/.{0,32}/g))
    matches.reverse() // handle last match first so indexes for other matches aren't affected
    matches.forEach(match => {
      /**
       * resolveuid links are formatted as, for example:
       *
       * href="./resolveuid/b463875b69d4156b90faaeb0dd7ca66b"
       *
       * the UID is the only part we need, so we split the string on "/" and
       * take the last part
       */
      const replacement = resolveUidForLink(
        match[0],
        courseData,
        courseUidsLookup,
        pagePath
      )
      htmlStr = replaceSubstring(
        htmlStr,
        match.index,
        match[0].length,
        replacement
      )
    })
  } catch (err) {
    loggers.fileLogger.error(err)
  }
  return htmlStr
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
      const newUrlBase = path.join("courses", courseId, "sections", ...sections)
      if (page.includes(".") && !page.includes(".htm")) {
        // page has a file extension and isn't HTML
        for (const media of courseData["course_files"]) {
          if (media["file_location"]) {
            if (
              media["file_type"] === "application/pdf" &&
              media["file_location"].includes(page)
            ) {
              // construct url to Hugo PDF viewer page
              return `${GETPAGESHORTCODESTART}${path.join(
                newUrlBase,
                stripPdfSuffix(page)
              )}${GETPAGESHORTCODEEND}`
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
            return `${GETPAGESHORTCODESTART}${path.join(
              newUrlBase,
              pageName
            )}${getHugoPathSuffix(
              coursePage,
              courseData
            )}${GETPAGESHORTCODEEND}`
          }
        }
      }
    }
  }

  return url
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
const resolveRelativeLinks = (htmlStr, courseData) => {
  try {
    // find and iterate all href tags
    const matches = Array.from(
      htmlStr.matchAll(/((href="(?<url1>[^"]*)")|(href='(?<url2>[^']*)'))/g)
    )
    matches.reverse() // handle last match first so indexes for other matches aren't affected
    matches.forEach(match => {
      // isolate the url
      const url = match.groups.url1 || match.groups.url2
      const replacement = resolveRelativeLink(url, courseData)
      htmlStr = replaceSubstring(
        htmlStr,
        match.index,
        match[0].length,
        `href="${replacement}"`
      )
    })
  } catch (err) {
    loggers.fileLogger.error(err)
  }
  return htmlStr.replace(/http:\/\/ocw.mit.edu/g, "")
}

const resolveYouTubeEmbed = (htmlStr, courseData) => {
  Object.keys(courseData["course_embedded_media"]).forEach(key => {
    if (htmlStr.includes(key)) {
      htmlStr = htmlStr.replace(
        key,
        getYoutubeEmbedCode(courseData["course_embedded_media"][key])
      )
    }
  })
  return htmlStr
}

const htmlSafeText = text =>
  text.replace(/("|')/g, "").replace(/(\r\n|\r|\n)/g, " ")

const stripS3 = text => {
  if (runOptions.strips3) {
    const staticPrefix = runOptions.staticPrefix ? runOptions.staticPrefix : ""
    return text.replace(AWS_REGEX, staticPrefix)
  } else return text
}

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
  pathToChildRecursive,
  getHugoPathSuffix,
  resolveUids,
  resolveRelativeLinks,
  resolveYouTubeEmbed,
  htmlSafeText,
  stripS3,
  unescapeBackticks,
  isCoursePublished,
  runOptions,
  stripPdfSuffix,
  replaceSubstring
}
