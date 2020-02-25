#!/usr/bin/env node

const path = require("path")

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

const getCourseNumber = courseData => {
  let courseNumber = courseData["sort_as"]
  if (courseData["extra_course_number"]) {
    if (courseData["extra_course_number"]["sort_as_col"]) {
      courseNumber = `${courseNumber} / ${courseData["extra_course_number"]["sort_as_col"]}`
    }
  }
  return courseNumber
}

const getCourseSectionFromFeatureUrl = courseFeature => {
  const urlParts = courseFeature["ocw_feature_url"]
    .replace(/\/index.html?/g, "")
    .split("/")
  return urlParts[urlParts.length - 1].split("#")[0]
}

const getCourseCollectionText = (courseCollection, separator) => {
  const feature = courseCollection["ocw_feature"]
  const subfeature = courseCollection["ocw_subfeature"]
  const speciality = courseCollection["ocw_speciality"]
  let collection = feature
  if (subfeature) {
    collection = `${collection} ${separator} ${subfeature}`
  }
  if (speciality) {
    collection = `${collection} ${separator} ${speciality}`
  }
  return collection
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
  getCourseNumber,
  getCourseSectionFromFeatureUrl,
  getCourseCollectionText,
  getYoutubeEmbedHtml,
  pathToChildRecursive
}
