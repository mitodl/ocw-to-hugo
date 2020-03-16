#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const util = require("util")
const path = require("path")
const markdownGenerators = require("./markdown_generators")
const cliProgress = require("cli-progress")
const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)
const readdir = util.promisify(fs.readdir)
let directoriesScanned = 0

const directoryExists = directory => {
  return (
    directory &&
    fs.existsSync(directory) &&
    fs.lstatSync(directory).isDirectory()
  )
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
  directoriesScanned = 0
  const contents = fs.readdirSync(source)
  const totalDirectories = contents.filter(file =>
    directoryExists(path.join(source, file))
  ).length
  console.log(`Scanning ${totalDirectories} subdirectories under ${source}`)
  progressBar.start(totalDirectories, directoriesScanned)
  contents.forEach(file => {
    const coursePath = path.join(source, file)
    if (fs.lstatSync(coursePath).isDirectory()) {
      // If the item is indeed a directory, read all files in it
      scanCourse(coursePath, destination).then(() => {
        directoriesScanned++
        progressBar.update(directoriesScanned)
      })
    }
  })
}

const scanCourse = async (coursePath, destination) => {
  /*
    This function scans a course directory for a master json file and processes it
  */
  const contents = await readdir(coursePath)
  for (const file of contents) {
    // If the item is a master json file, parse it and process into hugo markdown
    if (file.endsWith("_master.json")) {
      const courseData = JSON.parse(
        fs.readFileSync(path.join(coursePath, file))
      )
      const markdownData = markdownGenerators.generateMarkdownFromJson(
        courseData
      )
      writeMarkdownFilesRecursive(
        path.join(destination, courseData["short_url"]),
        markdownData
      )
    }
  }
}

const writeMarkdownFilesRecursive = (destination, markdownData) => {
  /*
    For a given course identifier string and array of objects with properties
    name and data, write Hugo markdown files
    */
  for (const section of markdownData) {
    const sectionPath = path.join(destination, section["name"])
    const sectionDirPath = path.dirname(sectionPath)
    if (!directoryExists(sectionDirPath)) {
      fs.mkdirSync(sectionDirPath, { recursive: true })
    }
    if (fs.existsSync(sectionPath)) {
      fs.unlinkSync(sectionPath)
    }
    fs.writeFileSync(sectionPath, section["data"])
    if (section.hasOwnProperty("files")) {
      section["files"].forEach(file => {
        const filePath = path.join(
          destination,
          section["name"].replace("/_index.md", ""),
          file["name"]
        )
        const fileDirPath = path.dirname(filePath)
        if (!directoryExists(fileDirPath)) {
          console.log(fileDirPath)
          fs.mkdirSync(fileDirPath)
        }
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        fs.writeFileSync(filePath, file["data"])
      })
    }
    if (section.hasOwnProperty("children")) {
      writeMarkdownFilesRecursive(destination, section["children"])
    }
  }
}

module.exports = {
  scanCourses,
  scanCourse,
  writeMarkdownFilesRecursive
}
