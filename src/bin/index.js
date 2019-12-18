#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const yargs = require("yargs")
const { addTrailingSlash } = require("../lib/helpers")
const { scanCourses } = require("../lib/file_operations")

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
  }).argv
// Ensure that there is a trailing slash on the source and destination paths
options.source = addTrailingSlash(options.source)
options.destination = addTrailingSlash(options.destination)

// Make sure that the source argument has been passed and it is a directory
if (options.source && fs.lstatSync(options.source).isDirectory()) {
  scanCourses(options.source, options.destination)
} else {
  console.log("Invalid source directory")
}
