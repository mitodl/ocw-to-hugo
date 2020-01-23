#!/usr/bin/env node
/* eslint-disable no-console */

require("dotenv").config()
const yargs = require("yargs")
const { scanCourses, generateSites } = require("../lib/file_operations")

// Gather arguments
const options = yargs
  .usage("Usage: -s <path> -d <path>")
  .option("s", {
    alias:        "source",
    describe:     "Source directory of courses",
    type:         "string",
    demandOption: true
  })
  .option("d", {
    alias:        "destination",
    describe:     "Destination directory for Hugo markdown",
    type:         "string",
    demandOption: true
  })
  .option("h", {
    alias:    "hugo_destination",
    describe:
      "Destination directory to generate hugo sites using hugo-course-publisher",
    type:         "string",
    demandOption: false
  }).argv

scanCourses(options.source, options.destination)
// if (options.hugo_destination) {
//   generateSites(
//     process.env.COURSE_PUBLISHER_REPO_URL,
//     process.env.COURSE_PUBLISHER_BRANCH,
//     options.destination,
//     options.hugo_destination
//   )
// }
