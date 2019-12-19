#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const path = require("path")
const { generateMarkdownFromJson } = require("./markdown_generators")
const cliProgress = require("cli-progress")
const progressBar = new cliProgress.SingleBar(
  {},
  cliProgress.Presets.shades_classic
)
let totalDirectories = 0
let directoriesScanned = 0
let filesProcessed = 0

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
  // Read the contents of the directory and continue
  const contents = fs.readdirSync(source)
  totalDirectories = contents.length
  console.log(`Scanning ${totalDirectories} subdirectories under ${source}`)
  progressBar.start(totalDirectories, directoriesScanned)
  // Iterate all subdirectories under source
  contents.forEach(file => {
    const coursePath = path.join(source, file)
    if (fs.lstatSync(coursePath).isDirectory()) {
      // If the item is indeed a directory, read all files in it
      scanCourse(coursePath, destination)
    }
  })
  progressBar.stop()
  console.log(
    `${directoriesScanned} directories scanned, ${filesProcessed} master JSON files processed`
  )
}

const scanCourse = (coursePath, destination) => {
  /*
    This function scans a course directory for a master json file and processes it
  */
  const contents = fs.readdirSync(coursePath)
  contents.forEach(file => {
    // If the item is a master json file, parse it and process into hugo markdown
    if (file.indexOf("_master.json") > -1) {
      const courseData = JSON.parse(
        fs.readFileSync(path.join(coursePath, file))
      )
      const markdownData = generateMarkdownFromJson(courseData)
      writeMarkdownFiles(courseData["short_url"], markdownData, destination)
      filesProcessed++
    }
  })
  directoriesScanned++
  progressBar.update(directoriesScanned)
}

const writeMarkdownFiles = (courseId, markdownData, destination) => {
  /*
    For a given course identifier string and array of objects with properties 
    name and data, write Hugo markdown files
    */
  if (destination && fs.lstatSync(destination).isDirectory()) {
    fs.mkdirSync(
      path.join(destination, courseId, "sections"),
      {
        recursive: true
      },
      err => {
        if (err) throw err
      }
    )
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
