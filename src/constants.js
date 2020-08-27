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
  HUGO_COURSE_PUBLISHER_GIT: "git@github.com:mitodl/hugo-course-publisher.git"
}
