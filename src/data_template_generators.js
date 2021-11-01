const moment = require("moment")

const { generateCourseDescription } = require("./markdown_generators")
const { INPUT_COURSE_DATE_FORMAT } = require("./constants")
const helpers = require("./helpers")

const generateDataTemplate = (courseData, pathLookup) => ({
  course_title:       courseData["title"],
  course_description: generateCourseDescription(courseData, pathLookup),
  course_image:       {
    content: helpers.getUidFromFilePath(courseData["image_src"]),
    website: courseData["short_url"]
  },
  course_image_thumbnail: {
    content: helpers.getUidFromFilePath(courseData["thumbnail_image_src"]),
    website: courseData["short_url"]
  },
  instructors: {
    content: (courseData["instructors"] || []).map(instructor =>
      helpers.addDashesToUid(instructor["uid"])
    ),
    website: "ocw-www"
  },
  department_numbers:      helpers.getDepartmentNumbers(courseData),
  learning_resource_types: (courseData["course_feature_tags"] || []).map(
    courseFeature => courseFeature["course_feature_tag"]
  ),
  topics:                helpers.getConsolidatedTopics(courseData["course_collections"]),
  primary_course_number: helpers.getPrimaryCourseNumber(courseData),
  extra_course_numbers:  helpers.getExtraCourseNumbers(courseData).join(", "),
  term:                  courseData["from_semester"],
  year:                  courseData["from_year"],
  level:                 !courseData["course_level"]
    ? []
    : courseData["course_level"] === "Both"
      ? ["Undergraduate", "Graduate"]
      : [courseData["course_level"]],
  other_versions: helpers.getOtherVersions(
    courseData["other_version_parent_uids"],
    courseData["short_url"],
    pathLookup
  ),
  archived_versions: helpers.getArchivedVersions(
    courseData["short_url"],
    pathLookup
  ),
  open_learning_library_versions: helpers.getOpenLearningLibraryVersions(
    courseData["open_learning_library_related"]
  )
})

const generateLegacyDataTemplate = (courseData, pathLookup) => {
  const dataTemplate = generateDataTemplate(courseData, pathLookup)
  dataTemplate["course_image_url"] = helpers.stripS3(
    courseData["image_src"] ? courseData["image_src"] : ""
  )
  dataTemplate["course_thumbnail_image_url"] = helpers.stripS3(
    courseData["thumbnail_image_src"] ? courseData["thumbnail_image_src"] : ""
  )
  dataTemplate["course_image_alternate_text"] = courseData[
    "image_alternate_text"
  ]
    ? courseData["image_alternate_text"]
    : ""
  dataTemplate["course_image_caption_text"] = courseData["image_caption_text"]
    ? courseData["image_caption_text"]
    : ""
  dataTemplate["publishdate"] = courseData["first_published_to_production"]
    ? moment(
      courseData["first_published_to_production"],
      INPUT_COURSE_DATE_FORMAT
    ).format()
    : ""
  delete dataTemplate["department_numbers"]
  dataTemplate["departments"] = helpers.getDepartments(courseData)
  dataTemplate["course_features"] = (
    courseData["course_feature_tags"] || []
  ).map(courseFeature =>
    helpers.getCourseFeatureObject(courseFeature, courseData, pathLookup)
  )
  dataTemplate["extra_course_numbers"] = helpers.getExtraCourseNumbers(
    courseData
  )
  dataTemplate["instructors"] = (courseData["instructors"] || []).map(
    instructor => {
      const name = instructor["salutation"]
        ? `${instructor["salutation"]} ${instructor["first_name"]} ${instructor["last_name"]}`
        : `${instructor["first_name"]} ${instructor["last_name"]}`

      return {
        instructor:     name,
        url:            helpers.makeCourseInfoUrl(name, "q"),
        first_name:     instructor["first_name"],
        last_name:      instructor["last_name"],
        middle_initial: instructor["middle_initial"],
        salutation:     instructor["salutation"],
        uid:            helpers.addDashesToUid(instructor["uid"])
      }
    }
  )
  return dataTemplate
}

module.exports = {
  generateDataTemplate,
  generateLegacyDataTemplate
}
