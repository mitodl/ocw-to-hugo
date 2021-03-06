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

const makeCourseUrlPrefix = courseId => `/courses/${courseId}`

const makeCourseUrlPrefixOrShortcode = (courseId, otherCourseId) => {
  if (!courseId) {
    throw new Error(`Missing course id ${courseId}`)
  }
  if (!otherCourseId) {
    throw new Error(`Missing other course id ${otherCourseId}`)
  }

  if (courseId === otherCourseId) {
    return BASEURL_SHORTCODE
  } else {
    return makeCourseUrlPrefix(courseId)
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

const getRootSections = courseData => {
  return courseData["course_pages"].filter(
    page =>
      page["parent_uid"] === courseData["uid"] &&
      page["type"] !== "CourseHomeSection" &&
      page["type"] !== "SRHomePage" &&
      page["type"] !== "DownloadSection"
  )
}

const getInternalMenuItems = (courseData, pathLookup) => {
  this["menuIndex"] = 0
  this["menuItems"] = []
  getRootSections(courseData).map(
    coursePage =>
      generatePageMenuItemsRecursive(coursePage, courseData, pathLookup),
    this
  )
  return this["menuItems"]
}

const generatePageMenuItemsRecursive = (page, courseData, pathLookup) => {
  const parents = courseData["course_pages"].filter(
    coursePage => coursePage["uid"] === page["parent_uid"]
  )
  const children = courseData["course_pages"].filter(
    coursePage => coursePage["parent_uid"] === page["uid"]
  )
  const shortTitle = page["short_page_title"]
  const hasParent = parents.length > 0
  const parent = hasParent ? parents[0] : null
  const parentId = hasParent ? parent["uid"] : null
  const inRootNav = page["parent_uid"] === courseData["uid"]
  const menuIndex = (this["menuIndex"] + 1) * 10
  const listInLeftNav = page["list_in_left_nav"]
  if (inRootNav || listInLeftNav) {
    const menuItem = {
      identifier: page["uid"],
      name:       shortTitle || "",
      url:        pathLookup.byUid[page["uid"]]["path"],
      weight:     menuIndex
    }
    if (parentId) {
      menuItem["parent"] = parentId
    }
    this["menuIndex"]++
    this["menuItems"].push(menuItem)
    children.map(
      page => generatePageMenuItemsRecursive(page, courseData, pathLookup),
      this
    )
  }
}

const getExternalMenuItems = courseData => {
  return EXTERNAL_LINKS_JSON.filter(
    externalLink => externalLink["course_id"] === courseData["short_url"]
  )
}

const getCourseNumbers = courseData => {
  const primaryCourseNumber = getUpdatedCourseNumber(
    `${courseData["department_number"]}.${courseData["master_course_number"]}`,
    courseData
  )
  return [primaryCourseNumber, ...getExtraCourseNumbers(courseData)]
}

const getExtraCourseNumbers = courseData => {
  const extraCourseNumbers = courseData["extra_course_number"] || []
  return extraCourseNumbers.map(extraCourseNumber =>
    getUpdatedCourseNumber(
      extraCourseNumber["linked_course_number_col"],
      courseData
    )
  )
}

const getUpdatedCourseNumber = (oldCourseNumber, courseData) => {
  let newCourseNumber = oldCourseNumber
  const courseNumberUpdates = courseData["new_course_numbers"] || []
  if (courseNumberUpdates) {
    const updatedCourseNumber = courseNumberUpdates.find(
      update => update["old_course_number_col"] === oldCourseNumber
    )
    if (updatedCourseNumber) {
      newCourseNumber = `${updatedCourseNumber["new_course_number_col"]} (formerly ${oldCourseNumber})`
    }
  }
  return newCourseNumber
}

const getCourseFeatureObject = (courseFeature, courseData, pathLookup) => {
  const feature = courseFeature["course_feature_tag"]
  const url = courseFeature["ocw_feature_url"]
  const featureObject = {}
  if (feature) {
    featureObject["feature"] = feature
  }
  if (url) {
    featureObject["url"] = resolveUidForLink(
      url,
      courseData,
      pathLookup
    ).replace(BASEURL_SHORTCODE, "")
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
  const youTubeCaptions = media["embedded_media"].filter(embeddedMedia => {
    return (
      embeddedMedia["title"] === "3play caption file" &&
      embeddedMedia["id"].endsWith(".vtt")
    )
  })
  const location = youTubeCaptions.length
    ? youTubeCaptions[0]["technical_location"]
    : ""
  return youTubeMedia
    .map(
      embeddedMedia =>
        `<div class="${YOUTUBE_SHORTCODE_PLACEHOLDER_CLASS}">${embeddedMedia["media_location"]};${location}</div>`
    )
    .join("")
}

const getVideoPageLink = (media, pathLookup) => {
  return `<a href = "${path.join(
    BASEURL_SHORTCODE,
    pathLookup.byUid[media["uid"]].path
  )}">${media["title"]}</a>`
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
      makeCourseUrlPrefixOrShortcode(course, thisCourseId),
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

    return path.join(makeCourseUrlPrefixOrShortcode(course, courseId), itemPath)
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

const resolveRelativeLink = (url, courseData, pathLookup, useDirectLink) => {
  // ensure that this is not resolveuid or an external link
  const thisCourseId = courseData["short_url"]
  if (url.includes("resolveuid")) {
    // handled in resolveUidForLink
    return null
  }

  url = url.replace(/^https?:\/\/ocw\.mit\.edu\//, "/")
  if (url.startsWith("/")) {
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
    if (parts[0] === "courses" && parts[2]) {
      const courseId = parts[2]
      if (parts.length === 3) {
        // course home page link
        return updatePath(url, [
          makeCourseUrlPrefixOrShortcode(courseId, thisCourseId)
        ])
      }
      const sections = parts.slice(3, parts.length - 1)
      const page = parts[parts.length - 1]

      const extension = path.extname(page)
      if (extension && !extension.startsWith(".htm")) {
        // page has a file extension and isn't HTML
        const paths = pathLookup.byCourse[courseId] || []
        for (const pathObj of paths) {
          if (pathObj.type === FILE_TYPE && page === pathObj.id) {
            if (pathObj.fileType === "application/pdf" && !useDirectLink) {
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
          makeCourseUrlPrefixOrShortcode(courseId, thisCourseId),
          ...(paths.length ? ["sections", ...paths] : [])
        ])
      }
    }

    // if nothing matches, we should still replace the url in case it had a legacy prefix
    // some urls like /ans7870 will be rewritten using varnish on the server, so they should stay the same
    return url
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

        const replacement = resolveRelativeLink(
          url,
          courseData,
          pathLookup,
          false
        )
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
          media["template_type"] !== "popup" &&
          media["template_type"] !== "thumbnail_popup"
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

const makeOtherVersionString = (otherCourse, courseUrl) => {
  const courseNumber = `${otherCourse["department_number"]}.${otherCourse["master_course_number"]}`
  const title = otherCourse["title"]
  const term = `${otherCourse["from_semester"]} ${otherCourse["from_year"]}`
  const scholarText = courseNumber.endsWith("SC") ? "SCHOLAR, " : ""

  return `[${courseNumber} ${title.toUpperCase()}](${courseUrl}) | ${scholarText} ${term.toUpperCase()}`
}

const getOtherVersions = (masterSubjects, courseId, pathLookup) => {
  const masterSubjectUids = masterSubjects || []
  const otherVersions = []
  for (const masterSubjectUid of masterSubjectUids) {
    const otherCourseUids = pathLookup.coursesByMasterSubject[masterSubjectUid]
    for (const otherCourseUid of otherCourseUids) {
      const otherCourse = pathLookup.byUid[otherCourseUid]
      if (otherCourse.course === courseId) {
        continue
      }

      const courseUrl = makeCourseUrlPrefix(otherCourse.course)
      otherVersions.push(makeOtherVersionString(otherCourse, courseUrl))
    }
  }

  return otherVersions
}

const getArchivedVersions = (courseId, pathLookup) => {
  const archived = pathLookup.archivedCoursesByCourse[courseId] || []
  return archived.map(({ uid, dspaceUrl }) =>
    makeOtherVersionString(pathLookup.byUid[uid], dspaceUrl)
  )
}

const getOpenLearningLibraryVersions = openLearningLibraryRelated => {
  return openLearningLibraryRelated
    ? openLearningLibraryRelated.map(openLearningLibraryVersion => {
      return `[${openLearningLibraryVersion["course"]}](${openLearningLibraryVersion["url"]}) | OPEN LEARNING LIBRARY`
    })
    : []
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

const parseDspaceUrl = url => {
  if (!url) {
    return null
  }

  const regexes = [
    /https?:\/\/dspace.mit.edu\/handle\/\/?([\d.]+\/\d+)/,
    /https?:\/\/hdl\.handle\.net\/([\d.]+\/\d+)/,
    /hdl:\/\/([\d.]+\/\d+)/
  ]

  for (const regex of regexes) {
    const match = url.match(regex)
    if (match) {
      return match[1]
    }
  }

  return null
}

module.exports = {
  distinct,
  directoryExists,
  createOrOverwriteFile,
  fileExists,
  findDepartmentByNumber,
  getDepartments,
  getRootSections,
  getInternalMenuItems,
  getExternalMenuItems,
  getCourseNumbers,
  getCourseFeatureObject,
  getCourseSectionFromFeatureUrl,
  getConsolidatedTopics,
  getYoutubeEmbedCode,
  getVideoPageLink,
  resolveUidMatches,
  resolveRelativeLinkMatches,
  resolveRelativeLink,
  resolveYouTubeEmbedMatches,
  buildPathsForCourse,
  htmlSafeText,
  stripS3,
  escapeDoubleQuotes,
  unescapeBackticks,
  isCoursePublished,
  getOtherVersions,
  getArchivedVersions,
  getOpenLearningLibraryVersions,
  runOptions,
  stripPdfSuffix,
  stripSlashPrefix,
  replaceSubstring,
  applyReplacements,
  getPathFragments,
  updatePath,
  makeCourseInfoUrl,
  parseDspaceUrl
}
