module.exports = {
  REPLACETHISWITHAPIPE:                          "REPLACETHISWITHAPIPE",
  BASEURL_PLACEHOLDER:                           "BASEURL_PLACEHOLDER",
  BASEURL_PLACEHOLDER_REGEX:                     new RegExp("BASEURL_PLACEHOLDER", "g"),
  BASEURL_SHORTCODE:                             "{{< baseurl >}}",
  EMBEDDED_RESOURCE_SHORTCODE_PLACEHOLDER_CLASS: "embedded_resource",
  MISSING_JSON_ERROR_MESSAGE:
    "To download courses from AWS, you must specify the -c argument.  For more information, see README.md",
  MISSING_COURSE_ERROR_MESSAGE:
    "Specified course was not found.  You need to either place the course there or use the -d option to download it from AWS.  For more information, see README.md",
  NO_COURSES_FOUND_MESSAGE:
    "No courses found!  For more information, see README.md",
  AWS_REGEX: new RegExp(
    /https?:\/\/open-learning-course-data(.*)\.s3\.amazonaws.com/g
  ),
  // eslint-disable-next-line no-irregular-whitespace
  IRREGULAR_WHITESPACE_REGEX: new RegExp(/(\|   )+\|/g),
  INPUT_COURSE_DATE_FORMAT:   "YYYY/M/D H:m:s.SSS",
  SUPPORTED_IFRAME_EMBEDS:    {
    "player.simplecast.com": {
      hugoShortcode: "simplecast",
      getID:         url => url.pathname.replace("/", "")
    }
  },

  // These are internal values for keeping track of uids.
  // None of these are used by the plone source data and none should be present in the output JSON.
  EMBEDDED_MEDIA_PAGE_TYPE: "embedded-media-page-type",
  COURSE_TYPE:              "course-type",
  FILE_TYPE:                "file-type",
  PAGE_TYPE:                "page-type",
  INSTRUCTOR_TYPE:          "instructor-type",

  // resourcetype options
  RESOURCE_TYPE_IMAGE:    "Image",
  RESOURCE_TYPE_VIDEO:    "Video",
  RESOURCE_TYPE_OTHER:    "Other",
  RESOURCE_TYPE_DOCUMENT: "Document"
}
