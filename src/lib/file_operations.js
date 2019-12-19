#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const path = require("path")
const { generateMarkdownFromJson } = require("./markdown_generators")
const cliProgress = require("cli-progress")
const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)
let totalDirectories = 0
let directoriesScanned = 0

const directoryExists = directory => {
  if (
    directory &&
    fs.existsSync(directory) &&
    fs.lstatSync(directory).isDirectory()
  ) {
    return true
  } else return false
}

const scanCourses = (source, destination) => {
  /*
    This function scans the source directory for course folders
  */
  // Make sure that the source and destination arguments have been passed and they are directories
  if (!directoryExists(source)) {
    throw new Error("Invalid source directory")
  }
  if (!directoryExists(destination)) {
    throw new Error("Invalid destination directory")
  }
  // Iterate all subdirectories under source
  fs.readdir(source, (err, contents) => {
    totalDirectories = contents.filter(file =>
      directoryExists(path.join(source, file))
    ).length
    console.log(`Scanning ${totalDirectories} subdirectories under ${source}`)
    progressBar.start(totalDirectories, directoriesScanned)
    contents.forEach(file => {
      const coursePath = path.join(source, file)
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
  fs.readdir(coursePath, (err, contents) => {
    contents.forEach(file => {
      // If the item is a master json file, parse it and process into hugo markdown
      if (file.endsWith("_master.json")) {
        const courseData = JSON.parse(
          fs.readFileSync(path.join(coursePath, file))
        )
        const markdownData = generateMarkdownFromJson(courseData)
        writeMarkdownFiles(courseData["short_url"], markdownData, destination)
      }
    })
    directoriesScanned++
    progressBar.update(directoriesScanned)
  })
}

const writeMarkdownFiles = (courseId, markdownData, destination) => {
  /*
    For a given course identifier string and array of objects with properties
    name and data, write Hugo markdown files
    */
  if (destination && fs.lstatSync(destination).isDirectory()) {
    fs.mkdirSync(path.join(destination, courseId, "sections"), {
      recursive: true
    })
    markdownData.forEach(file => {
      const filePath = path.join(destination, courseId, file["name"])
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
