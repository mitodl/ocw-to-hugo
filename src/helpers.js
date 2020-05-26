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

const resolveUids = (htmlStr, page, courseData) => {
  try {
    const pagePath = `${pathToChildRecursive(
      path.join("courses", courseData["short_url"], "sections"),
      page,
      courseData
    )}${getHugoPathSuffix(page, courseData)}`
    Array.from(htmlStr.matchAll(/\.?\/?resolveuid\/.{0,32}/g)).forEach(
      match => {
        const url = match[0]
        const urlParts = url.split("/")
        const uid = urlParts[urlParts.length - 1]
        const linkedPage = courseData["course_pages"].find(
          coursePage => coursePage["uid"] === uid
        )
        const linkedFile = courseData["course_files"].find(
          file => file["uid"] === uid
        )
        if (linkedPage) {
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
          if (linkedFile["file_type"] === "application/pdf") {
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

const resolveRelativeLinks = (htmlStr, courseData, log = false) => {
  try {
    Array.from(htmlStr.matchAll(/href="([^"]*)"/g)).forEach(match => {
      const url = match[0].replace(`href="`, "").replace(`"`, "")
      if (!url.includes("resolveuid") && url[0] === "/") {
        const parts = url.split("/")
        const courseId = parts[3]
        if (courseId) {
          const layers = parts.length - 4
          const sections = []
          let page = null
          if (layers === 0) {
            page = "index.htm"
          } else if (layers === 1) {
            page = parts[4]
          } else {
            for (let i = parts.length - layers; i < parts.length; i++) {
              const section = parts[i]
              if (i + 1 === parts.length) {
                page = section
              } else {
                sections.push(section)
              }
            }
          }
          const suffix = page === "index.htm" ? "/_index.md" : ""
          const newUrlBase = path.join(
            "courses",
            courseId,
            "sections",
            ...sections
          )
          if (page.includes(".") && !page.includes(".htm")) {
            courseData["course_files"].forEach(media => {
              if (
                media["file_type"] === "application/pdf" &&
                media["file_location"].includes(page)
              ) {
                const newUrl = `${GETPAGESHORTCODESTART}${path.join(
                  newUrlBase,
                  page.replace(".pdf", "")
                )}${suffix}${GETPAGESHORTCODEEND}`
                htmlStr = htmlStr.replace(url, newUrl)
              } else if (media["file_location"].includes(page)) {
                htmlStr = htmlStr.replace(url, media["file_location"])
              }
            })
          } else {
            courseData["course_pages"].forEach(coursePage => {
              if (coursePage["short_url"] === page) {
                const pageName = page.replace(/(index)?\.html?/g, "")
                const newUrl = `${GETPAGESHORTCODESTART}${path.join(
                  newUrlBase,
                  pageName === "" ? "_index.md" : pageName
                )}${suffix}${GETPAGESHORTCODEEND}`
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
