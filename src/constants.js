module.exports = {
  REPLACETHISWITHAPIPE:       "REPLACETHISWITHAPIPE",
  GETPAGESHORTCODESTART:      "GETPAGESHORTCODESTART",
  GETPAGESHORTCODEEND:        "GETPAGESHORTCODEEND",
  MISSING_JSON_ERROR_MESSAGE:
    "To download courses from AWS, you must specify the -c argument.  For more information, see README.md",
  MISSING_COURSE_ERROR_MESSAGE:
    "Specified course was not found.  You need to either place the course there or use the -d option to download it from AWS.  For more information, see README.md",
  NO_COURSES_FOUND_MESSAGE:
    "No courses found!  For more information, see README.md",
  AWS_REGEX: new RegExp(
    /https?:\/\/open-learning-course-data(.*)\.s3\.amazonaws.com/g
  ),
  BOILERPLATE_MARKDOWN: [
    {
      path:    "",
      name:    "_index.md",
      content: {
        title: ""
      }
    },
    {
      path:    "search",
      name:    "_index.md",
      content: {
        title: "Search",
        type:  "search"
      }
    },
    {
      path:    "courses",
      name:    "_index.md",
      content: {
        title: "Courses",
        type:  "courseindex"
      }
    }
  ],
  INPUT_COURSE_DATE_FORMAT: "YYYY/M/D H:m:s.SSS",
  SUPPORTED_IFRAME_EMBEDS:  {
    "player.simplecast.com": {
      hugoShortcode: "simplecast",
      getID:         url => url.pathname.replace("/", "")
    }
  }
}
