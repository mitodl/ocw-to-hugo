const _ = require("lodash")
const path = require("path")
const moment = require("moment")

const {
  serializeSearchParams
} = require("@mitodl/course-search-utils/dist/url_utils")
const fsPromises = require("./fsPromises")
const DEPARTMENTS_JSON = require("./departments.json")
const EXTERNAL_LINKS_JSON = require("./external_links.json")
const {
  AWS_REGEX,
  BASEURL_SHORTCODE,
  FILE_TYPE,
  INPUT_COURSE_DATE_FORMAT,
  YOUTUBE_SHORTCODE_PLACEHOLDER_CLASS
} = require("./constants")
const loggers = require("./loggers")
const runOptions = {}

const makeCourseUrlPrefix = (courseId, otherCourseId) => {
  if (!courseId) {
    throw new Error(`Missing course id ${courseId}`)
  }
  if (!otherCourseId) {
    throw new Error(`Missing other course id ${otherCourseId}`)
  }

  if (courseId === otherCourseId) {
    return BASEURL_SHORTCODE
  } else {
    return `/courses/${courseId}`
  }
}

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

const DEPARTMENTS_LOOKUP = new Map(
  DEPARTMENTS_JSON.map(department => [department["depNo"], department])
)
const findDepartmentByNumber = departmentNumber =>
  DEPARTMENTS_LOOKUP.get(departmentNumber.toString())

const getDepartments = courseData => {
  let departmentNumbers = getCourseNumbers(courseData).map(
    number => number.split(".")[0]
  )
  // deduplicate and remove numbers that don't match with our list
  departmentNumbers = [...new Set(departmentNumbers)].filter(
    findDepartmentByNumber
  )
  return departmentNumbers.map(findDepartmentByNumber).map(department => ({
    department: department.title,
    url:        makeCourseInfoUrl(department.title, "department_name")
  }))
}

const getExternalLinks = courseData => {
  return EXTERNAL_LINKS_JSON.filter(
    externalLink => externalLink["course_id"] === courseData["short_url"]
  )
}

const getCourseNumbers = courseData => {
  const extraCourseNumbers = courseData["extra_course_number"] || []
  return [
    `${courseData["department_number"]}.${courseData["master_course_number"]}`,
    ...extraCourseNumbers.map(
      extraCourseNumber => extraCourseNumber["linked_course_number_col"]
    )
  ]
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

const FAKE_BASE_URL = "https://sentinel.example.com"
const getPathFragments = url =>
  new URL(url, FAKE_BASE_URL).pathname.split("/").filter(Boolean)
const updatePath = (url, pathPieces) => {
  const hasBaseUrl = pathPieces[0] && pathPieces[0] === BASEURL_SHORTCODE
  if (hasBaseUrl) {
    // cut out the shortcode here and add it back in the end
    // so we don't mangle it in the URL object
    pathPieces = pathPieces.slice(1)
  }

  const obj = new URL(url, FAKE_BASE_URL)
  obj.pathname = pathPieces.join("/")
  let newUrl = obj.toString()
  if (newUrl.startsWith(FAKE_BASE_URL)) {
    newUrl = newUrl.slice(FAKE_BASE_URL.length)
  }
  if (hasBaseUrl) {
    newUrl = path.join(BASEURL_SHORTCODE, newUrl)
  }
  return newUrl
}

const getCourseSectionFromFeatureUrl = courseFeature => {
  const featureUrl = courseFeature["ocw_feature_url"]
  if (!featureUrl.includes("resolveuid")) {
    let [last, ...urlParts] = getPathFragments(featureUrl).reverse()
    last = last.replace(/^index.html?$/, "")
    return updatePath(featureUrl, [...urlParts, last])
  } else {
    return featureUrl
  }
}

const makeCourseInfoUrl = (value, searchParam) =>
  `/search/?${serializeSearchParams(
    searchParam === "q"
      ? {
        text: `"${value}"`
      }
      : {
        activeFacets: {
          [searchParam]: value
        }
      }
  )}`

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
        subtopics: [],
        url:       makeCourseInfoUrl(feature, "topics")
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
        specialities: [],
        url:          makeCourseInfoUrl(subfeature, "topics")
      }
      topicObj.subtopics.push(subtopicObj)
      subtopicsLookup[feature][subfeature] = subtopicObj
    }

    if (speciality) {
      subtopicObj.specialities.push({
        speciality: speciality,
        url:        makeCourseInfoUrl(speciality, "topics")
      })
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
    .map(
      embeddedMedia =>
        `<div class="${YOUTUBE_SHORTCODE_PLACEHOLDER_CLASS}">${embeddedMedia["media_location"]}</div>`
    )
    .join("")
}

const getVideoPageLink = (media, pathLookup) => {
  return `<a href = "${pathLookup.byUid[media["uid"]].path}">${
    media["title"]
  }</a>`
}

const buildPathRecursive = (item, itemsLookup, courseUid, pathLookup) => {
  const { filenameKey, page } = item
  const uid = page["uid"]
  const parentUid = page["parent_uid"]
  const parentItem = itemsLookup[parentUid]

  if (courseUid === parentUid) {
    // course is the parent, so link should be off of /sections
    const filename = page[filenameKey]
    pathLookup[uid] = path.join("/sections", filename)
    return
  }

  if (!parentItem) {
    loggers.fileLogger.error(`Missing parent ${parentUid}, parent of ${uid}`)
    return
  }

  if (!pathLookup[parentUid]) {
    buildPathRecursive(parentItem, itemsLookup, courseUid, pathLookup)
    if (!pathLookup[parentUid]) {
      loggers.fileLogger.error(
        `Unable to find path for ${parentUid}, parent of ${uid}`
      )
      return
    }
  }

  pathLookup[uid] = path.join(pathLookup[parentUid], page[filenameKey])
}

const buildPathsForCourse = courseData => {
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

const makePdfLink = (thisCourseId, pathObj, pathLookup) => {
  const { parentUid, id } = pathObj
  const parentTuple = pathLookup.byUid[parentUid]
  if (parentTuple) {
    const { course, path: parent } = parentTuple
    const pdfPath = path.join(
      makeCourseUrlPrefix(course, thisCourseId),
      parent,
      id.toLowerCase()
    )
    return stripPdfSuffix(pdfPath)
  }
  return null
}

const resolveUidForLink = (url, courseData, pathLookup) => {
  const courseId = courseData["short_url"]
  const [uid, ...urlParts] = getPathFragments(url).reverse()

  if (pathLookup.byUid[uid]) {
    const pathObj = pathLookup.byUid[uid]
    const { course, path: itemPath, fileType, type, fileLocation } = pathObj

    if (type === FILE_TYPE) {
      if (fileType === "application/pdf") {
        // create a link to the generated PDF viewer page for this PDF file
        const pdfLink = makePdfLink(courseId, pathObj, pathLookup)
        if (pdfLink) {
          return pdfLink
        }
      } else {
        // link directly to the static content
        return stripS3(fileLocation)
      }
    }

    return path.join(makeCourseUrlPrefix(course, courseId), itemPath)
  }

  return null
}

/**
 * @param {string} htmlStr
 * @param {object} page
 * @param {object} courseData
 * @param {object} pathLookup
 *
 * The purpose of this function is to resolve "resolveuid" links in OCW HTML.
 * It takes 4 parameters; an HTML string to parse, the page that the string came from,
 * the course data object, and a lookup from uid to [course-id, path].
 *
 */
const resolveUidMatches = (htmlStr, page, courseData, pathLookup) => {
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
        const replacement = resolveUidForLink(match[0], courseData, pathLookup)
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

const resolveRelativeLink = (url, courseData, pathLookup) => {
  // ensure that this is not resolveuid or an external link
  const thisCourseId = courseData["short_url"]
  if (!url.includes("resolveuid") && url[0] === "/") {
    // split the url into its parts
    const parts = getPathFragments(url)
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
    if (parts[0] !== "courses") {
      return null
    }

    const courseId = parts[2]
    if (courseId) {
      if (parts.length === 3) {
        // course home page link
        return updatePath(url, [makeCourseUrlPrefix(courseId, thisCourseId)])
      }
      const sections = parts.slice(3, parts.length - 1)
      const page = parts[parts.length - 1]

      const extension = path.extname(page)
      if (extension && !extension.startsWith(".htm")) {
        // page has a file extension and isn't HTML
        const paths = pathLookup.byCourse[courseId] || []
        for (const pathObj of paths) {
          if (pathObj.type === FILE_TYPE && page === pathObj.id) {
            if (pathObj.fileType === "application/pdf") {
              const pdfLink = makePdfLink(
                thisCourseId,
                pathObj,
                pathLookup,
                sections
              )
              const parentPathSections = path
                .dirname(pathObj.path)
                .split("/")
                .slice(2)
              if (
                pdfLink &&
                parentPathSections.join("/") === sections.join("/")
              ) {
                return pdfLink
              }
            } else {
              return stripS3(pathObj.fileLocation)
            }
          }
        }
      } else {
        // match page from url to the short_url property on a course page
        const isIndex = page.startsWith("index.htm")
        const paths = [...sections]
        if (!isIndex) {
          paths.push(page)
        }

        return updatePath(url, [
          makeCourseUrlPrefix(courseId, thisCourseId),
          ...(paths.length ? ["sections", ...paths] : [])
        ])
      }
    }
  }

  return null
}

/**
 * @param {string} htmlStr
 * @param {object} courseData
 * @param {object} pathLookup
 *
 * The purpose of this function is to find relatively linked content
 * in a given HTML string and try to resolve that URL to the static content
 * or course section it is supposed to point to.
 *
 */
const resolveRelativeLinkMatches = (htmlStr, courseData, pathLookup) => {
  try {
    // find and iterate all href tags
    const matches = Array.from(
      htmlStr.matchAll(/((href="(?<url1>[^"]*)")|(href='(?<url2>[^']*)'))/g)
    )
    return matches
      .map(match => {
        const url = match.groups.url1 || match.groups.url2

        const replacement = resolveRelativeLink(url, courseData, pathLookup)
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

const resolveYouTubeEmbedMatches = (htmlStr, courseData, pathLookup) => {
  return Object.keys(courseData["course_embedded_media"])
    .map(key => {
      const index = htmlStr.indexOf(key)
      if (index !== -1) {
        // match is meant to resemble a regex match object enough
        // to be used with applyReplacements above
        const match = [key]
        match.index = index
        const media = courseData["course_embedded_media"][key]
        const replacement =
          media["template_type"] !== "popup"
            ? getYoutubeEmbedCode(media)
            : getVideoPageLink(media, pathLookup)
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

const stripPrefix = prefix => text => {
  if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
    return text.slice(prefix.length)
  }
  return text
}
const stripSlashPrefix = stripPrefix("/")

const replaceSubstring = (text, index, length, substring) =>
  `${text.substring(0, index)}${substring}${text.substring(index + length)}`

module.exports = {
  distinct,
  directoryExists,
  createOrOverwriteFile,
  fileExists,
  findDepartmentByNumber,
  getDepartments,
  getExternalLinks,
  getCourseNumbers,
  getCourseFeatureObject,
  getCourseSectionFromFeatureUrl,
  getConsolidatedTopics,
  getYoutubeEmbedCode,
  resolveUidMatches,
  resolveRelativeLinkMatches,
  resolveYouTubeEmbedMatches,
  buildPathsForCourse,
  htmlSafeText,
  stripS3,
  escapeDoubleQuotes,
  unescapeBackticks,
  isCoursePublished,
  runOptions,
  stripPdfSuffix,
  stripSlashPrefix,
  replaceSubstring,
  applyReplacements,
  getPathFragments,
  updatePath,
  makeCourseInfoUrl
}
