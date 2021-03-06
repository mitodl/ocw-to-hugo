#!/usr/bin/env node
/* eslint-disable no-console */

const yargs = require("yargs")
const { downloadCourses } = require("../aws_sync")
const { scanCourses } = require("../file_operations")
const { rmdir, mkdir } = require("../fsPromises")

const { MISSING_JSON_ERROR_MESSAGE } = require("../constants")
const loggers = require("../loggers")
const helpers = require("../helpers")

// Gather arguments
const options = yargs
  .usage("Usage: -i <path> -o <path>")
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
  })
  .option("c", {
    alias:        "courses",
    describe:     "A JSON file describing courses to process",
    type:         "string",
    demandOption: false
  })
  .option("download", {
    describe:
      "A flag that if set to true to will download courses passed in from AWS",
    type:         "boolean",
    demandOption: false
  })
  .option("strips3", {
    describe:
      "A flag that tells ocw-to-hugo to strip the s3 base url from OCW resources",
    type:         "boolean",
    demandOption: false
  })
  .option("staticPrefix", {
    describe:
      "When strips3 is set to true, the value passed into this argument will replace the s3 prefix on static assets",
    type:         "string",
    demandOption: false
  })
  .option("verbose", {
    describe:     "Write error logging and other extra output",
    type:         "boolean",
    demandOption: false
  })
  .option("rm", {
    describe:
      "Recursively remove the contents of the destination directory before conversion",
    type:         "boolean",
    demandOption: false
  }).argv

Object.keys(options).forEach(key => {
  helpers.runOptions[key] = options[key]
})

const run = async () => {
  if (options.courses && options.download) {
    await downloadCourses(options.courses, options.input)
  } else if (options.download && !options.courses) {
    throw new Error(MISSING_JSON_ERROR_MESSAGE)
  }
  if (options.rm) {
    console.log(`Removing the contents of ${options.output}...`)
    await rmdir(options.output, { recursive: true })
    await mkdir(options.output)
  }
  await scanCourses(options.input, options.output)
}

run()
  .catch(err => {
    console.error("Error:", err)
    loggers.fileLogger.error(err)
    process.exit(1)
  })
  .then(() => {
    if (loggers.memoryTransport.logs.length) {
      if (options.verbose) {
        console.error(
          "Found errors which were logged: ",
          loggers.memoryTransport.logs
        )
        process.exit(1)
      }
    }
  })
