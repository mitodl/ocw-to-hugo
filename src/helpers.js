#!/usr/bin/env node

const _ = require("lodash")
const path = require("path")
const departmentsJson = require("./departments.json")

const findDepartmentByNumber = departmentNumber => {
  return departmentsJson.find(department => {
    return department["depNo"] === departmentNumber.toString()
  })
}

const getCourseImageUrl = courseData => {
  /*
    Constructs the course image filename using parts of the course short_url
    */
  const courseNameParts = courseData["short_url"].split("-")
  const imageName = `${courseNameParts[0]}-${
    courseNameParts[1]
  }${courseNameParts[courseNameParts.length - 2].charAt(0)}${courseNameParts[
    courseNameParts.length - 1
  ].slice(2)}.jpg`
  const courseImageMedia = courseData["course_files"].find(media => {
    if (media["parent_uid"] === courseData["uid"]) {
      const fileLocationParts = media["file_location"].split("/")
      const jsonFile = fileLocationParts[fileLocationParts.length - 1]
      const imageFile = `${media["uid"]}_${imageName}`
      return jsonFile === imageFile
    }
  })
  return courseImageMedia
    ? courseImageMedia["file_location"]
    : "images/course_image.jpg"
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

const getConsolidatedTopics = courseCollections => {
  let topics = {}
  courseCollections.forEach(courseCollection => {
    const { ocw_feature, ocw_subfeature, ocw_speciality } = courseCollection

    const collectionTopic = {
      [ ocw_feature ]: {}
    }
    if (ocw_subfeature) {
      collectionTopic[ocw_feature][ocw_subfeature] = [ocw_speciality].filter(
        Boolean
      )
    }
    topics = _.merge(topics, collectionTopic)
  })
  return topics
}

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

module.exports = {
  getCourseImageUrl,
  findDepartmentByNumber,
  getDepartments,
  getCourseNumbers,
  getCourseFeatureObject,
  getCourseSectionFromFeatureUrl,
  getConsolidatedTopics,
  getYoutubeEmbedHtml,
  pathToChildRecursive
}
