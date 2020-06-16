#!/usr/bin/env node
/* eslint-disable no-console */

const yargs = require("yargs")
const { downloadCourses } = require("../aws_sync")
const { scanCourses } = require("../file_operations")

const { MISSING_JSON_ERROR_MESSAGE } = require("../constants")
const loggers = require("../loggers")

// Gather arguments
const options = yargs
  .usage("Usage: -s <path> -d <path>")
  .option("c", {
    alias:        "courses",
    describe:     "A JSON file describing courses to process",
    type:         "string",
    demandOption: false
  })
  .option("d", {
    alias:    "download",
    describe:
      "A flag that if set to true to will download courses passed in from AWS",
    type:         "boolean",
    demandOption: false
  })
  .option("i", {
    alias:        "input",
    describe:     "Input directory of courses",
    type:         "string",
    demandOption: true
  })
  .option("o", {
    alias:        "output",
    describe:     "Output directory for Hugo markdown",
    type:         "string",
    demandOption: true
  }).argv

const run = async () => {
  if (options.courses && options.download) {
    await downloadCourses(options.courses, options.input)
  } else if (options.download && !options.courses) {
    loggers.fileLogger.log({
      level:   "error",
      message: MISSING_JSON_ERROR_MESSAGE
    })
    throw new Error(MISSING_JSON_ERROR_MESSAGE)
  }
  scanCourses(options.input, options.output, options.courses)
}

run()
