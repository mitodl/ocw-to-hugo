const moment = require("moment")

const { generateCourseDescription } = require("./markdown_generators")
const { INPUT_COURSE_DATE_FORMAT } = require("./constants")
const helpers = require("./helpers")

const generateDataTemplate = (courseData, pathLookup) => {
  return {
    course_title:       courseData["title"],
    course_description: generateCourseDescription(courseData, pathLookup),
    course_image_url:   helpers.stripS3(
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
    instructors: {
      content: (courseData["instructors"] || []).map(instructor =>
        helpers.addDashesToUid(instructor["uid"])
      ),
      website: "ocw-www"
    },
    departments:     helpers.getDepartments(courseData),
    course_features: courseData["course_feature_tags"]
      ? courseData["course_feature_tags"].map(courseFeature =>
        helpers.getCourseFeatureObject(courseFeature, courseData, pathLookup)
      )
      : [],
    topics:                helpers.getConsolidatedTopics(courseData["course_collections"]),
    primary_course_number: helpers.getPrimaryCourseNumber(courseData),
    extra_course_numbers:  helpers.getExtraCourseNumbers(courseData),
    term:                  `${courseData["from_semester"]} ${courseData["from_year"]}`,
    level:                 {
      level: courseData["course_level"],
      url:   helpers.makeCourseInfoUrl(courseData["course_level"], "level")
    },
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
  }
}

const generateLegacyDataTemplate = (courseData, pathLookup) => {
  const dataTemplate = generateDataTemplate(courseData, pathLookup)
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
        uid:            instructor["uid"]
      }
    }
  )
  return dataTemplate
}

module.exports = {
  generateDataTemplate,
  generateLegacyDataTemplate
}
