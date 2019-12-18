#!/usr/bin/env node

const fs = require("fs")

const addTrailingSlash = path => {
  /*
    Adds a trailing slash to a path if it doesn't have one
    */
  const lastChar = path.substr(path.length - 1)
  if (lastChar !== "/") {
    return `${path}/`
  } else return path
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
  courseData["course_files"].forEach(media => {
    if (media["parent_uid"] === courseData["uid"]) {
      const fileLocationParts = media["file_location"].split("/")
      const jsonFile = fileLocationParts[fileLocationParts.length - 1]
      const imageFile = `${media["uid"]}_${imageName}`
      if (jsonFile === imageFile) {
        return media["file_location"]
      }
    }
  })
  return "images/course_image.jpg"
}

module.exports = {
  addTrailingSlash,
  getCourseImageUrl
}