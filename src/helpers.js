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
  BASEURL_PLACEHOLDER,
  RESOURCE_FILE_PLACEHOLDER,
  FILE_TYPE,
  INPUT_COURSE_DATE_FORMAT,
  EMBEDDED_RESOURCE_SHORTCODE_PLACEHOLDER_CLASS,
  EMBEDDED_MEDIA_PAGE_TYPE,
  COURSE_TYPE,
  RESOURCE_TYPE_OTHER,
  RESOURCE_TYPE_DOCUMENT,
  RESOURCE_TYPE_IMAGE,
  FORBIDDEN_FILENAMES
} = require("./constants")
const loggers = require("./loggers")
const runOptions = {}

const makeCourseUrlPrefix = courseId => `/courses/${courseId}`

const directoryExists = async directory => {
  try {
    return (await fsPromises.lstat(directory)).isDirectory()
  } catch (err) {
    // this will happen if we don't have access to the directory or if it doesn't exist
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

const getDepartmentNumbers = courseData => {
  const departmentNumbers = [
    getPrimaryCourseNumber(courseData),
    ...getExtraCourseNumbers(courseData)
  ].map(number => number.split(".")[0])
  // deduplicate and remove numbers that don't match with our list
  return [...new Set(departmentNumbers)].filter(findDepartmentByNumber)
}

const getDepartments = courseData => {
  return getDepartmentNumbers(courseData)
    .map(findDepartmentByNumber)
    .map(department => ({
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
      identifier: addDashesToUid(page["uid"]),
      name:       shortTitle || "",
      url:        pathLookup.byUid[page["uid"]]["path"],
      weight:     menuIndex
    }
    if (parentId) {
      menuItem["parent"] = addDashesToUid(parentId)
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

const getPrimaryCourseNumber = courseData => {
  return getUpdatedCourseNumber(
    `${courseData["department_number"]}.${courseData["master_course_number"]}`,
    courseData
  )
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
      pathLookup,
      false,
      true
    )
  }
  return featureObject
}

const FAKE_BASE_URL = "https://sentinel.example.com"
const getPathFragments = url =>
  new URL(url, FAKE_BASE_URL).pathname.split("/").filter(Boolean)
const updatePath = (url, pathPieces, isRelativeToRoot) => {
  const hasBaseUrl = pathPieces[0] && pathPieces[0] === BASEURL_PLACEHOLDER
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
    newUrl = path.join(BASEURL_PLACEHOLDER, newUrl)
  }
  if (isRelativeToRoot) {
    newUrl = stripSlashPrefix(newUrl)
  }
  return newUrl
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
const getConsolidatedTopics = courseCollections =>
  courseCollections.map(
    ({
      ocw_feature: feature,
      ocw_subfeature: subfeature,
      ocw_speciality: speciality
    }) => [feature, subfeature, speciality].filter(Boolean)
  )

/* eslint-disable camelcase */
const getYoutubeEmbedCode = (media, pathLookup) => {
  return `<div class="${EMBEDDED_RESOURCE_SHORTCODE_PLACEHOLDER_CLASS}">${addDashesToUid(
    media["uid"]
  )}</div>`
}

const makeResourceSlug = (originalFilename, resourceNameSet) => {
  const originalFilenameMinusExt = stripSuffix(path.extname(originalFilename))(
    originalFilename
  )
  const prefix = originalFilenameMinusExt
    .toLowerCase()
    .replace(/[ .]/g, "-")
    .replace(/[^-\w]/g, "")
  let filename = prefix

  let idx = 1
  while (resourceNameSet.has(filename) || FORBIDDEN_FILENAMES.has(filename)) {
    filename = `${prefix}-${idx}`
    idx++
  }
  resourceNameSet.add(filename)

  return filename
}

const buildPaths = (
  item,
  itemsLookup,
  courseUid,
  pathLookup,
  uidInfoLookup,
  resourceNameSet
) => {
  const { filenameKey, page } = item
  const uid = page["uid"]
  const uidInfo = uidInfoLookup[uid]
  const isResource =
    uidInfo &&
    (uidInfo["type"] === FILE_TYPE ||
      uidInfo["type"] === EMBEDDED_MEDIA_PAGE_TYPE)
  const parentUid = page["parent_uid"]
  const parentItem = itemsLookup[parentUid]
  const parentIsCourseHomePage = courseUid === parentUid

  if (!parentIsCourseHomePage) {
    if (!parentItem) {
      loggers.fileLogger.error(`Missing parent ${parentUid}, parent of ${uid}`)
      return
    }

    if (!pathLookup[parentUid]) {
      loggers.fileLogger.error(
        `Unable to find path for ${parentUid}, parent of ${uid}`
      )
      return
    }
  }
  const rootPath = page["is_media_gallery"] ? "/video_galleries" : "/pages"
  const unalteredPath = path.join(
    parentIsCourseHomePage ? rootPath : pathLookup[parentUid].path,
    page[filenameKey]
  )
  if (isResource) {
    pathLookup[uid] = {
      unalteredPath,
      path: path.join(
        "/resources",
        makeResourceSlug(uidInfo[filenameKey], resourceNameSet)
      )
    }
  } else {
    pathLookup[uid] = {
      unalteredPath,
      path: unalteredPath
    }
  }
}

const buildPathsForCourse = (courseData, uidInfoLookup) => {
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

  const resourceNameSet = new Set()
  for (const item of Object.values(itemsLookup)) {
    buildPaths(
      item,
      itemsLookup,
      courseUid,
      pathLookup,
      uidInfoLookup,
      resourceNameSet
    )
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

const constructInternalLink = (
  linkCourse,
  pathRelativeToCourseRoot,
  linkType,
  uid,
  pageCourse,
  useShortcodes,
  isRelativeToRoot,
  courseData
) => {
  const isSameCourse = linkCourse === pageCourse
  const strippedPath =
    pathRelativeToCourseRoot !== "/"
      ? stripSlashPrefix(pathRelativeToCourseRoot)
      : pathRelativeToCourseRoot

  // if this links to an image resource, return the resource_file placeholder
  const matchingFile = courseData["course_files"].find(
    file => file["uid"] === uid
  )
  if (matchingFile) {
    if (getResourceType(matchingFile["file_type"]) === RESOURCE_TYPE_IMAGE) {
      return `${RESOURCE_FILE_PLACEHOLDER} ${addDashesToUid(uid)} ${path.join(
        "/",
        strippedPath
      )}`
    }
  }

  if (!useShortcodes) {
    // course.json can't use shortcodes at the moment. However the course description is only shown on the course
    // home page so we can make links relative to the course home page. Other fields may need the full link
    if (isSameCourse && isRelativeToRoot) {
      return strippedPath
    } else {
      return path.join("/courses", linkCourse, strippedPath)
    }
  }

  if (isSameCourse) {
    return path.join(BASEURL_PLACEHOLDER, strippedPath)
  } else {
    return path.join("/courses", linkCourse, strippedPath)
  }
}

const resolveUidForLink = (
  url,
  courseData,
  pathLookup,
  useShortcodes,
  isRelativeToRoot
) => {
  const courseId = courseData["short_url"]
  const [uid] = getPathFragments(url).reverse()

  if (pathLookup.byUid[uid]) {
    const pathObj = pathLookup.byUid[uid]
    const { course, path: itemPath, type } = pathObj

    return constructInternalLink(
      course,
      itemPath,
      type,
      uid,
      courseId,
      useShortcodes,
      isRelativeToRoot,
      courseData
    )
  }

  return null
}

/**
 * @param {string} htmlStr
 * @param {object} page
 * @param {object} courseData
 * @param {object} pathLookup
 * @param {boolean} useShortcodes
 * @param {boolean} isRelativeToRoot
 *
 * Resolve "resolveuid" links in OCW HTML.
 */
const resolveUidMatches = (
  htmlStr,
  courseData,
  pathLookup,
  useShortcodes,
  isRelativeToRoot
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
          pathLookup,
          useShortcodes,
          isRelativeToRoot
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

const resolveRelativeLink = (
  url,
  courseData,
  pathLookup,
  useDirectLink,
  useShortcodes,
  isRelativeToRoot
) => {
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
      const paths = pathLookup.byCourse[courseId] || []
      if (parts.length === 3) {
        // course home page link
        const internalLink = constructInternalLink(
          courseId,
          "",
          COURSE_TYPE,
          null,
          thisCourseId,
          useShortcodes,
          isRelativeToRoot,
          courseData
        )
        return updatePath(url, getPathFragments(internalLink), isRelativeToRoot)
      }
      const sections = parts.slice(3, parts.length - 1)
      const page = parts[parts.length - 1]

      const extension = path.extname(page)
      if (extension && !extension.startsWith(".htm")) {
        // page has a file extension and isn't HTML
        for (const pathObj of paths) {
          if (
            pathObj.type === FILE_TYPE &&
            pathObj.unalteredPath ===
              `/${["pages", ...sections, page].join("/")}`
          ) {
            if (!useDirectLink) {
              const { type, course, path, uid } = pathObj
              return constructInternalLink(
                course,
                path,
                type,
                uid,
                thisCourseId,
                useShortcodes,
                isRelativeToRoot,
                courseData
              )
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

        const itemPath = path.join(...(paths.length ? ["pages", ...paths] : []))
        const internalLink = constructInternalLink(
          courseId,
          itemPath,
          null,
          null,
          thisCourseId,
          useShortcodes,
          isRelativeToRoot,
          courseData
        )
        return updatePath(url, getPathFragments(internalLink), isRelativeToRoot)
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
 * @param {boolean} useShortcodes
 * @param {boolean} isRelativeToRoot
 *
 * The purpose of this function is to find relatively linked content
 * in a given HTML string and try to resolve that URL to the static content
 * or course section it is supposed to point to.
 *
 */
const resolveRelativeLinkMatches = (
  htmlStr,
  courseData,
  pathLookup,
  useShortcodes,
  isRelativeToRoot
) => {
  try {
    // find and iterate all href tags
    const matches = Array.from(
      htmlStr.matchAll(/((href="(?<url1>[^"]*)")|(href='(?<url2>[^']*)'))/g)
    )
    return matches
      .map(match => {
        const url = match.groups.url1 || match.groups.url2 || ""

        const replacement = resolveRelativeLink(
          url,
          courseData,
          pathLookup,
          false,
          useShortcodes,
          isRelativeToRoot
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

const resolveYouTubeEmbedMatches = (
  htmlStr,
  courseData,
  pathLookup,
  useShortcodes,
  isRelativeToRoot
) => {
  return Object.keys(courseData["course_embedded_media"])
    .map(key => {
      const index = htmlStr.indexOf(key)
      if (index !== -1) {
        // match is meant to resemble a regex match object enough
        // to be used with applyReplacements above
        const match = [key]
        match.index = index
        const media = courseData["course_embedded_media"][key]

        const { course, path, type, uid } = pathLookup.byUid[media["uid"]]
        const link = constructInternalLink(
          course,
          path,
          type,
          uid,
          courseData["short_url"],
          useShortcodes,
          isRelativeToRoot,
          courseData
        )

        const replacement =
          media["template_type"] !== "popup" &&
          media["template_type"] !== "thumbnail_popup"
            ? getYoutubeEmbedCode(media, pathLookup)
            : `<a href = "${link}">${media["title"]}</a>`

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
  if (suffix.length === 0) {
    return text
  }

  if (text.toLowerCase().endsWith(suffix.toLowerCase())) {
    return text.slice(0, -suffix.length)
  }
  return text
}

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

const addDashesToUid = uid => {
  if (!uid.match(/[a-f0-9]{32}/)) {
    return uid
  }
  return `${uid.substr(0, 8)}-${uid.substr(8, 4)}-${uid.substr(
    12,
    4
  )}-${uid.substr(16, 4)}-${uid.substr(20)}`
}

const getUidFromFilePath = filePath => {
  return addDashesToUid(path.basename(filePath).split("_")[0])
}

const getVideoUidsFromPage = (page, courseData) => {
  const videos = Object.values(courseData["course_embedded_media"]).filter(
    obj => obj["parent_uid"] === page["uid"]
  )
  videos.sort((a, b) => a.order_index - b.order_index)

  return videos.map(video => addDashesToUid(video["uid"]))
}

const getResourceType = mimeType => {
  switch (mimeType) {
  case "application/pdf":
    return RESOURCE_TYPE_DOCUMENT
  case "image/gif":
  case "image/jpeg":
  case "image/png":
  case "image/svg+xml":
  case "image/tiff":
    return RESOURCE_TYPE_IMAGE
  default:
    return RESOURCE_TYPE_OTHER
  }
}

const getPreviousSibling = (elem, selector) => {
  let sibling = elem.previousElementSibling

  if (!selector) return sibling

  while (sibling) {
    if (sibling.matches(selector)) return sibling
    sibling = sibling.previousElementSibling
  }
}

const getNextSibling = (elem, selector) => {
  let sibling = elem.nextElementSibling

  if (!selector) return sibling

  while (sibling) {
    if (sibling.matches(selector)) return sibling
    sibling = sibling.nextElementSibling
  }
}

module.exports = {
  directoryExists,
  createOrOverwriteFile,
  findDepartmentByNumber,
  getDepartmentNumbers,
  getDepartments,
  getRootSections,
  getInternalMenuItems,
  getExternalMenuItems,
  getPrimaryCourseNumber,
  getExtraCourseNumbers,
  getCourseFeatureObject,
  getConsolidatedTopics,
  getYoutubeEmbedCode,
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
  stripSuffix,
  stripSlashPrefix,
  makeResourceSlug,
  getPathFragments,
  updatePath,
  applyReplacements,
  makeCourseInfoUrl,
  parseDspaceUrl,
  addDashesToUid,
  replaceSubstring,
  getUidFromFilePath,
  getVideoUidsFromPage,
  getResourceType,
  getPreviousSibling,
  getNextSibling
}
