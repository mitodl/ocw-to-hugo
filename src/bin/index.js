#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const yargs = require("yargs")

const options = yargs
  .usage("Usage: -s <path>")
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

if (options.source && fs.lstatSync(options.source).isDirectory()) {
  fs.readdir(options.source, function(err, directories) {
    console.log(`Scanning subdirectories under ${options.source}`)
    directories.forEach(directory => {
      const coursePath = `${options.source}/${directory}`
      if (fs.lstatSync(coursePath).isDirectory()) {
        fs.readdir(coursePath, function(err, files) {
          files.forEach(file => {
            if (file.indexOf("_master.json") > -1) {
              const courseData = JSON.parse(
                fs.readFileSync(`${coursePath}/${file}`)
              )
              processJson(courseData)
            }
          })
        })
      }
    })
  })
} else {
  console.log("Invalid source directory")
}

function processJson(courseData) {
  // TODO: process the master JSON and generate markdown
}
