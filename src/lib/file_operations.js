#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const { generateMarkdownFromJson } = require("./markdown_generators")
const cliProgress = require("cli-progress")
const progressBar = new cliProgress.SingleBar(
  {},
  cliProgress.Presets.shades_classic
)
const { addTrailingSlash } = require("../lib/helpers")
let totalDirectories = 0
let directoriesScanned = 0
let filesProcessed = 0

const scanCourses = (source, destination) => {
  /*
    This function scans the source directory for course folders
  */
  // Make sure that the source argument has been passed and it is a directory
  let error = "Invalid "
  if (
    !source ||
    !fs.existsSync(source) ||
    !fs.lstatSync(source).isDirectory()
  ) {
    error += "source directory "
  }
  if (
    !destination ||
    !fs.existsSync(destination) ||
    !fs.lstatSync(destination).isDirectory()
  ) {
    if (error === "Invalid ") {
      error += "destination directory"
    } else {
      error += "and destination directory"
    }
  }
  if (error !== "Invalid ") {
    throw new Error(error.trim())
  }
  // Ensure that there is a trailing slash on the source and destination paths
  source = addTrailingSlash(source)
  destination = addTrailingSlash(destination)
  fs.readdir(source, (err, directories) => {
    // Count the total amount of directories and start the progress bar
    directories.forEach(directory => {
      const coursePath = source + directory
      if (fs.lstatSync(coursePath).isDirectory()) {
        totalDirectories++
      }
    })
    console.log(`Scanning ${totalDirectories} subdirectories under ${source}`)
    progressBar.start(totalDirectories, directoriesScanned)
    // Iterate all subdirectories under source
    directories.forEach(directory => {
      const coursePath = source + directory
      if (fs.lstatSync(coursePath).isDirectory()) {
        // If the item is indeed a directory, read all files in it
        scanCourse(coursePath, destination)
      }
    })
  })
}

const scanCourse = (coursePath, destination) => {
  /*
    This function scans a course directory for a master json file and processes it
  */
  fs.readdir(coursePath, (err, files) => {
    files.forEach(file => {
      // If the item is a master json file, parse it and process into hugo markdown
      if (file.indexOf("_master.json") > -1) {
        const courseData = JSON.parse(fs.readFileSync(`${coursePath}/${file}`))
        const markdownData = generateMarkdownFromJson(courseData)
        writeMarkdownFiles(courseData["short_url"], markdownData, destination)
        filesProcessed++
      }
    })
    directoriesScanned++
    progressBar.update(directoriesScanned)
    if (directoriesScanned === totalDirectories) {
      progressBar.stop()
      console.log(
        `${directoriesScanned} directories scanned, ${filesProcessed} master JSON files processed`
      )
    }
  })
}

const writeMarkdownFiles = (courseId, markdownData, destination) => {
  /*
    For a given course identifier string and array of objects with properties 
    name and data, write Hugo markdown files
    */
  if (destination && fs.lstatSync(destination).isDirectory()) {
    fs.mkdirSync(
      `${destination + courseId}/sections`,
      {
        recursive: true
      },
      err => {
        if (err) throw err
      }
    )
    markdownData.forEach(file => {
      const filePath = `${destination + courseId}/${file["name"]}`
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      fs.writeFileSync(filePath, file["data"])
    })
  }
}

module.exports = {
  scanCourses,
  scanCourse,
  writeMarkdownFiles
}
