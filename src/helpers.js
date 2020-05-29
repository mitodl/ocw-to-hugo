const _ = require("lodash")
const fs = require("fs")
const path = require("path")
const departmentsJson = require("./departments.json")

const { GETPAGESHORTCODESTART, GETPAGESHORTCODEEND } = require("./constants")
const loggers = require("./loggers")

const distinct = (value, index, self) => {
  return self.indexOf(value) === index
}

const directoryExists = directory => {
  return (
    directory &&
    fs.existsSync(directory) &&
    fs.lstatSync(directory).isDirectory()
  )
}

const createOrOverwriteFile = (file, body) => {
  const dirName = path.dirname(file)
  if (!directoryExists(dirName)) {
    fs.mkdirSync(dirName, { recursive: true })
  } else if (fs.existsSync(file)) {
    fs.unlinkSync(file)
  }
  fs.writeFileSync(file, body)
}

const findDepartmentByNumber = departmentNumber => {
  return departmentsJson.find(department => {
    return department["depNo"] === departmentNumber.toString()
  })
}

const getDepartments = courseData => {
  const primaryDepartmentNumber = courseData["sort_as"].split(".")[0]
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
  let courseNumbers = [courseData["sort_as"]]
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
  let topics = {}
  courseCollections.forEach(courseCollection => {
    const { ocw_feature, ocw_subfeature, ocw_speciality } = courseCollection

    const collectionTopic = {
      [ocw_feature]: {}
    }
    if (ocw_subfeature) {
      collectionTopic[ocw_feature][ocw_subfeature] = [ocw_speciality].filter(
        Boolean
      )
    }

    topics = _.mergeWith(topics, collectionTopic, (objValue, srcValue) => {
      if (_.isArray(objValue)) {
        return objValue.concat(srcValue)
      }
    })
  })
  return topics
}
/* eslint-disable camelcase */

const getYoutubeEmbedHtml = media => {
  const youTubeMedia = media["embedded_media"].filter(embeddedMedia => {
    return embeddedMedia["id"] === "Video-YouTube-Stream"
  })
  return youTubeMedia
    .map(
      embeddedMedia =>
        `<div class="text-center"><iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${embeddedMedia["media_info"]}" frameborder="0" allow="encrypted-media; picture-in-picture"></iframe></div>`
    )
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

/**
 * @param {string} htmlStr
 * @param {object} page
 * @param {object} courseData
 *
 * The purpose of this function is to resolve "resolveuid" links in OCW HTML.
 * It takes 3 parameters; an HTML string to parse, the page that the string came from
 * and the course data object.
 *
 */
const resolveUids = (htmlStr, page, courseData) => {
  try {
    // get the Hugo path to the page
    const pagePath = `${pathToChildRecursive(
      path.join("courses", courseData["short_url"], "sections"),
      page,
      courseData
    )}${getHugoPathSuffix(page, courseData)}`
    // iterate all resolveuid links by regex match
    Array.from(htmlStr.matchAll(/\.?\/?resolveuid\/.{0,32}/g)).forEach(
      match => {
        /**
         * resolveuid links are formatted as, for example:
         *
         * href="./resolveuid/b463875b69d4156b90faaeb0dd7ca66b"
         *
         * the UID is the only part we need, so we split the string on "/" and
         * take the last part
         */
        const url = match[0]
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
        if (linkedPage) {
          // a course_page has been found for this UID
          const linkPagePath = `${pathToChildRecursive(
            path.join("courses", courseData["short_url"], "sections"),
            linkedPage,
            courseData
          )}${getHugoPathSuffix(linkedPage, courseData)}`
          htmlStr = htmlStr.replace(
            url,
            `${GETPAGESHORTCODESTART}${linkPagePath}${GETPAGESHORTCODEEND}`
          )
        }
        if (linkedFile) {
          // a course_file has been found for this UID
          if (linkedFile["file_type"] === "application/pdf") {
            // create a link to the generated PDF viewer page for this PDF file
            const pdfPath = `${pagePath.replace("/_index.md", "/")}${
              linkedFile["id"]
            }`
            htmlStr = htmlStr.replace(
              url,
              `${GETPAGESHORTCODESTART}${pdfPath.replace(
                ".pdf",
                ""
              )}${GETPAGESHORTCODEEND}`
            )
          } else {
            // link directly to the static content
            htmlStr = htmlStr.replace(url, linkedFile["file_location"])
          }
        }
      }
    )
  } catch (err) {
    loggers.fileLogger.error(err.message)
  }
  return htmlStr
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
    Array.from(
      htmlStr.matchAll(/((href="([^"]*)")|(href='([^']*)'))/g)
    ).forEach(match => {
      // isolate the url
      const trimmedUrl = match[0].trim()
      const url = trimmedUrl.slice(0, -1).replace(/(href=")|(href=')/g, "")
      // ensure that this is not resolveuid or an external link
      if (!url.includes("resolveuid") && url[0] === "/") {
        // split the url into its parts
        const parts = url.split("/")
        /**
         * disassembles the OCW URL based on the following patten:
         *
         * EXAMPLE: /courses/mathematics/18-01-single-variable-calculus-fall-2006/exams/prfinalsol.pdf
         *
         * 0: blank string
         * 1: "courses"
         * 2: department ("mathematics")
         * 3: course ID ("18-01-single-variable-calculus-fall-2006")
         * 4 - ?: section and subsections with the page / file at the end
         */
        const courseId = parts[3]
        if (courseId) {
          const layers = parts.length - 4
          let sections = []
          let page = null
          if (layers === 0) {
            // course home page link
            page = "index.htm"
          } else if (layers === 1) {
            // root section link
            page = parts[4]
          } else {
            // this is a link to something in a subsection, slice out the layers and page
            sections = parts.slice(parts.length - layers, parts.length - 1)
            page = parts.slice(parts.length - 1, parts.length)[0]
          }
          // build the base of the Hugo url
          const newUrlBase = path.join(
            "courses",
            courseId,
            "sections",
            ...sections
          )
          if (page.includes(".") && !page.includes(".htm")) {
            // page has a file extension and isn't HTML
            courseData["course_files"].forEach(media => {
              if (
                media["file_type"] === "application/pdf" &&
                media["file_location"].includes(page)
              ) {
                // construct url to Hugo PDF viewer page
                const newUrl = `${GETPAGESHORTCODESTART}${path.join(
                  newUrlBase,
                  page.replace(".pdf", "")
                )}${GETPAGESHORTCODEEND}`
                htmlStr = htmlStr.replace(url, newUrl)
              } else if (media["file_location"].includes(page)) {
                // write link directly to file
                htmlStr = htmlStr.replace(url, media["file_location"])
              }
            })
          } else {
            // match page from url to the short_url property on a course page
            courseData["course_pages"].forEach(coursePage => {
              if (coursePage["short_url"] === page) {
                const pageName = page.replace(/(index)?\.html?/g, "")
                const newUrl = `${GETPAGESHORTCODESTART}${path.join(
                  newUrlBase,
                  pageName
                )}${getHugoPathSuffix(
                  coursePage,
                  courseData
                )}${GETPAGESHORTCODEEND}`
                htmlStr = htmlStr.replace(url, newUrl)
              }
            })
          }
        }
      }
    })
  } catch (err) {
    loggers.fileLogger.error(err.message)
  }
  return htmlStr
}

const resolveYouTubeEmbed = (htmlStr, courseData) => {
  Object.keys(courseData["course_embedded_media"]).forEach(key => {
    if (htmlStr.includes(key)) {
      htmlStr = htmlStr.replace(
        key,
        getYoutubeEmbedHtml(courseData["course_embedded_media"][key])
      )
    }
  })
  return htmlStr
}

module.exports = {
  distinct,
  directoryExists,
  createOrOverwriteFile,
  findDepartmentByNumber,
  getDepartments,
  getCourseNumbers,
  getCourseFeatureObject,
  getCourseSectionFromFeatureUrl,
  getConsolidatedTopics,
  getYoutubeEmbedHtml,
  pathToChildRecursive,
  getHugoPathSuffix,
  resolveUids,
  resolveRelativeLinks,
  resolveYouTubeEmbed
}
