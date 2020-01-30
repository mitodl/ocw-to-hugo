#!/usr/bin/env node

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
    .replace(/\/index.htm?l/, "/")
    .split("/")
  return urlParts[urlParts.length - 1]
}

const makeTopic = feature => {
  let topic = ""
  if (feature["ocw_feature"]) {
    topic = feature["ocw_feature"]
  }
  if (feature["ocw_subfeature"]) {
    topic = `${topic} - ${feature["ocw_subfeature"]}`
  }
  return topic
}

module.exports = {
  getCourseImageUrl,
  getCourseNumber,
  getCourseSectionFromFeatureUrl,
  makeTopic
}
