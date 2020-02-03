#!/usr/bin/env node
/* eslint-disable no-console */

const yargs = require("yargs")
const { scanCourses } = require("../file_operations")

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

scanCourses(options.source, options.destination)
