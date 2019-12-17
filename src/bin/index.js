#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const yargs = require("yargs")
const cliProgress = require("cli-progress")
const { addTrailingSlash, writeMarkdownFiles } = require("../lib/helpers")
const {
  generateCourseHomeFrontMatter,
  generateCourseSectionFrontMatter,
  generateCourseFeatures,
  generateCourseCollections,
  generateCourseSectionMarkdown
} = require("../lib/markdown_generators")

// Init progress bar and gather arguments
const progressBar = new cliProgress.SingleBar(
  {},
  cliProgress.Presets.shades_classic
)
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
// Ensure that there is a trailing slash on the soure and destination paths
options.source = addTrailingSlash(options.source)
options.destination = addTrailingSlash(options.destination)
let totalDirectories = 0
let directoriesScanned = 0
let filesProcessed = 0

// Make sure that the source argument has been passed and it is a directory
if (options.source && fs.lstatSync(options.source).isDirectory()) {
  fs.readdir(options.source, (err, directories) => {
    // Count the total amount of directories and start the progress bar
    directories.forEach(directory => {
      const coursePath = options.source + directory
      if (fs.lstatSync(coursePath).isDirectory()) {
        totalDirectories++
      }
    })
    console.log(
      `Scanning ${totalDirectories} subdirectories under ${options.source}`
    )
    progressBar.start(totalDirectories, directoriesScanned)
    // Iterate all subdirectories under source
    directories.forEach(directory => {
      const coursePath = options.source + directory
      if (fs.lstatSync(coursePath).isDirectory()) {
        // If the item is indeed a directory, read all files in it
        fs.readdir(coursePath, (err, files) => {
          files.forEach(file => {
            // If the item is a master json file, parse it and process into hugo markdown
            if (file.indexOf("_master.json") > -1) {
              const courseData = JSON.parse(
                fs.readFileSync(`${coursePath}/${file}`)
              )
              const markdownData = processJson(courseData)
              writeMarkdownFiles(
                courseData["short_url"],
                markdownData,
                options.destination
              )
            }
          })
          directoriesScanned++
          progressBar.update(directoriesScanned)
        })
      }
    })
    // After the process is finished, deliver a report to the console
    ;(function waitForScan() {
      if (directoriesScanned === totalDirectories) {
        progressBar.stop()
        console.log(
          `${directoriesScanned} directories scanned, ${filesProcessed} master JSON files processed`
        )
      } else {
        setTimeout(waitForScan, 30)
      }
    })()
  })
} else {
  console.log("Invalid source directory")
}

function processJson(courseData) {
  /*
    This function takes JSON data parsed from a master.json file and returns markdown data
    */
  const markdownData = []
  let courseHomeMarkdown = generateCourseHomeFrontMatter(courseData)
  courseHomeMarkdown += generateCourseFeatures(courseData)
  courseHomeMarkdown += generateCourseCollections(courseData)
  markdownData.push({
    name: "_index.md",
    data: courseHomeMarkdown
  })
  let menuIndex = 10
  courseData["course_pages"].forEach(page => {
    if (page["text"]) {
      const pageName = page["short_url"]
      let courseSectionMarkdown = generateCourseSectionFrontMatter(
        page["title"],
        menuIndex
      )
      courseSectionMarkdown += generateCourseSectionMarkdown(page, courseData)
      const sectionData = {
        name: `sections/${pageName}.md`,
        data: courseSectionMarkdown
      }
      markdownData.push(sectionData)
      menuIndex += 10
    }
  })
  filesProcessed++
  return markdownData
}
