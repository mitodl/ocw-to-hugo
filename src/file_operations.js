#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const rimraf = require("rimraf")
const util = require("util")
const path = require("path")
const env = require("dotenv").config().parsed
const AWS = require("aws-sdk")
const cliProgress = require("cli-progress")

const markdownGenerators = require("./markdown_generators")

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

const multiBarFormatter = (options, params, payload) => {
  const bar = options.barCompleteString.substr(
    0,
    Math.round(params.progress * options.barsize)
  )
  return `${payload.prefix.substr(0, 30)}... ${bar} | ETA: ${params.eta}s | ${
    params.value
  }/${params.total}`
}

const downloadCourses = async (coursesJson, coursesDir) => {
  if (!fs.existsSync(coursesJson)) {
    throw new Error("Invalid courses JSON")
  }
  if (
    !env["AWS_REGION"] ||
    !env["AWS_BUCKET_NAME"] ||
    !env["AWS_ACCESS_KEY"] ||
    !env["AWS_SECRET_ACCESS_KEY"]
  ) {
    throw new Error("Invalid AWS connection info")
  }
  AWS.config = new AWS.Config({
    region:      env["AWS_REGION"],
    credentials: new AWS.Credentials({
      accessKeyId:     env["AWS_ACCESS_KEY"],
      secretAccessKey: env["AWS_SECRET_ACCESS_KEY"]
    })
  })
  const s3 = new AWS.S3()
  const courses = JSON.parse(fs.readFileSync(coursesJson))["courses"]
  const totalCourses = courses.length
  console.log(`Downloading ${totalCourses} courses from AWS...`)
  const multibar = new cliProgress.MultiBar({
    stopOnComplete: true,
    hideCursor:     true,
    forceRedraw:    true,
    format:         multiBarFormatter
  })
  const promises = []
  courses.forEach(async course => {
    const courseDir = path.join(coursesDir, course)
    if (directoryExists(courseDir)) {
      rimraf.sync(courseDir)
    }
    fs.mkdirSync(courseDir, { recursive: true })
    const bucketParams = {
      Bucket: env["AWS_BUCKET_NAME"],
      Prefix: course
    }
    promises.push(
      downloadCourseRecursive(s3, bucketParams, coursesDir, multibar)
    )
  })
  return Promise.all(promises)
}

const downloadCourseRecursive = (
  s3,
  bucketParams,
  destination,
  multibar,
  resolveParent = null
) => {
  return new Promise(resolveOuter => {
    s3.listObjectsV2(bucketParams)
      .promise()
      .then(listData => {
        const totalFiles = listData.Contents.length
        const bar = multibar.create(totalFiles, 0, {
          prefix: bucketParams.Prefix
        })
        new Promise(resolveInner => {
          listData.Contents.forEach(content => {
            s3.getObject({
              Bucket: bucketParams.Bucket,
              Key:    content.Key
            })
              .promise()
              .then(data => {
                fs.writeFileSync(path.join(destination, content.Key), data.Body)
                bar.increment()
                if (bar.value === bar.total) {
                  resolveInner()
                }
              })
          })
        }).then(() => {
          if (listData.IsTruncated) {
            bucketParams.ContinuationToken = listData.NextContinuationToken
            downloadCourseRecursive(
              s3,
              bucketParams,
              destination,
              multibar,
              resolveOuter
            )
          }
          if (resolveParent) {
            resolveParent()
          } else {
            resolveOuter()
          }
        })
      })
  })
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
    if (RegExp("^[0-9a-f]{32}_master.json").test(file)) {
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
    writeSectionFiles("files", section, destination)
    writeSectionFiles("media", section, destination)
    if (section.hasOwnProperty("children")) {
      writeMarkdownFilesRecursive(destination, section["children"])
    }
  }
}

const writeSectionFiles = (key, section, destination) => {
  if (section.hasOwnProperty(key)) {
    section[key].forEach(file => {
      try {
        const filePath = path.join(destination, file["name"])
        const fileDirPath = path.dirname(filePath)
        if (!directoryExists(fileDirPath)) {
          fs.mkdirSync(fileDirPath, { recursive: true })
        }
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        fs.writeFileSync(filePath, file["data"])
      } catch (err) {}
    })
  }
}

module.exports = {
  downloadCourses,
  scanCourses,
  scanCourse,
  writeMarkdownFilesRecursive
}
