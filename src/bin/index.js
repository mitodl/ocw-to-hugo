#!/usr/bin/env node
/* eslint-disable no-console */

const yargs = require("yargs")
const stats = require("../stats")
const { scanCourses } = require("../file_operations")

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
  .option("v", {
    alias:        "verbose",
    describe:     "Enable verbose mode",
    type:         "boolean",
    demandOption: false
  }).argv

const exitHandler = (exitOptions, exitCode) => {
  if (options.verbose) {
    stats.print()
  }
  if (exitOptions.exit) {
    process.exit()
  }
}

process.on("exit", exitHandler.bind(null, { exit: true }))

scanCourses(options.source, options.destination, options.verbose)
