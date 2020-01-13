#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const fse = require("fs-extra")
const os = require("os")
const cp = require("child_process")
const path = require("path")
const git = require("nodegit")
const { generateMarkdownFromJson } = require("./markdown_generators")
const cliProgress = require("cli-progress")
const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)
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
  fs.readdir(source, (err, contents) => {
    const totalDirectories = contents.filter(file =>
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

const generateSites = (
  coursePublisherRepoUrl,
  coursePublisherBranch,
  markdownLocation,
  hugoDestination
) => {
  const coursePublisherDir = "./private/hugo-course-publisher"
  fse.emptyDirSync(coursePublisherDir)
  git.Clone.clone(coursePublisherRepoUrl, coursePublisherDir, {
    checkoutBranch: coursePublisherBranch
  }).then(repository => {
    const cpOptions = {
      cwd:   path.join(coursePublisherDir, "app"),
      stdio: "inherit",
      shell: true
    }
    fse.emptyDirSync(hugoDestination)
    fse.removeSync(path.join(coursePublisherDir, "app", "site", "static", "assignments"))
    fse.removeSync(path.join(coursePublisherDir, "app", "site", "static", "exams"))
    fse.removeSync(path.join(coursePublisherDir, "app", "site", "static", "related-resources"))
    cp.execSync("yarn install", cpOptions)
    cp.execSync("npm run build", cpOptions)
    directoriesScanned = 0
    const directories = fs.readdirSync(markdownLocation)
    const totalDirectories = directories.length
    progressBar.start(totalDirectories, directoriesScanned)
    directories.forEach(file => {
      const coursePath = path.join(markdownLocation, file)
      if (fs.lstatSync(coursePath).isDirectory()) {
        // If the item is indeed a directory, read all files in it
        generateSite(file, coursePath, coursePublisherDir, hugoDestination)
      }
    })
  })
}

const generateSite = (
  courseId,
  coursePath,
  coursePublisherDir,
  destination
) => {
  const contentDir = path.join(coursePublisherDir, "app", "site", "content")
  const appDir = path.join(coursePublisherDir, "app")
  const distDir = path.join(coursePublisherDir, "app", "dist")
  const outputDir = path.join(destination, courseId)
  fse.emptyDirSync(contentDir)
  fse.copySync(coursePath, contentDir)
  try {
    cp.execSync("npm run build:hugo", { cwd: appDir })
  } catch (ex) {
    // eslint-disable-next-line no-empty
  }
  fse.copySync(distDir, outputDir)
  directoriesScanned++
  progressBar.update(directoriesScanned)
}

module.exports = {
  scanCourses,
  scanCourse,
  writeMarkdownFiles,
  generateSites
}
