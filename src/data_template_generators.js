const moment = require("moment")

const { INPUT_COURSE_DATE_FORMAT } = require("./constants")
const helpers = require("./helpers")

const generateDataTemplate = courseData => {
  return {
    course_id:        courseData["short_url"],
    course_title:     courseData["title"],
    course_image_url: helpers.stripS3(
      courseData["image_src"] ? courseData["image_src"] : ""
    ),
    course_thumbnail_image_url: helpers.stripS3(
      courseData["thumbnail_image_src"] ? courseData["thumbnail_image_src"] : ""
    ),
    course_image_alternate_text: courseData["image_alternate_text"]
      ? courseData["image_alternate_text"]
      : "",
    course_image_caption_text: courseData["image_caption_text"]
      ? courseData["image_caption_text"]
      : "",
    publishdate: courseData["first_published_to_production"]
      ? moment(
        courseData["first_published_to_production"],
        INPUT_COURSE_DATE_FORMAT
      ).format()
      : "",
    instructors: courseData["instructors"]
      ? courseData["instructors"].map(
        instructor =>
          `Prof. ${instructor["first_name"]} ${instructor["last_name"]}`
      )
      : [],
    departments:     helpers.getDepartments(courseData),
    course_features: courseData["course_features"].map(courseFeature =>
      helpers.getCourseFeatureObject(courseFeature)
    ),
    topics:         helpers.getConsolidatedTopics(courseData["course_collections"]),
    course_numbers: helpers.getCourseNumbers(courseData),
    term:           `${courseData["from_semester"]} ${courseData["from_year"]}`,
    level:          courseData["course_level"]
  }
}

module.exports = {
  generateDataTemplate
}
