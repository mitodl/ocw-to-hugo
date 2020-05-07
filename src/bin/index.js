#!/usr/bin/env node
/* eslint-disable no-console */

const yargs = require("yargs")
const { downloadCourses, scanCourses } = require("../file_operations")

// Gather arguments
const options = yargs
  .usage("Usage: -s <path> -d <path>")
  .option("c", {
    alias:        "courses",
    describe:     "A JSON file describing courses to download from AWS",
    type:         "string",
    demandOption: false
  })
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
  }).argv

if (options.courses) {
  downloadCourses(options.courses, options.source).then(() => {
    scanCourses(options.source, options.destination)
  })
} else {
  scanCourses(options.source, options.destination)
}
