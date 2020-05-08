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
const loggers = require("./loggers")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)
const readdir = util.promisify(fs.readdir)

const directoryExists = directory => {
  return (
    directory &&
    fs.existsSync(directory) &&
    fs.lstatSync(directory).isDirectory()
  )
}

const downloadCourses = (coursesJson, coursesDir) => {
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
  progressBar.start(totalCourses, 0)
  return Promise.all(
    courses.map(async course => {
      const courseDir = path.join(coursesDir, course)
      if (directoryExists(courseDir)) {
        rimraf.sync(courseDir)
      }
      fs.mkdirSync(courseDir, { recursive: true })
      const bucketParams = {
        Bucket: env["AWS_BUCKET_NAME"],
        Prefix: course
      }
      return new Promise(resolve => {
        downloadCourseRecursive(s3, bucketParams, coursesDir).then(() => {
          progressBar.increment()
          resolve()
        })
      })
    })
  )
}

const downloadCourseRecursive = (s3, bucketParams, destination) => {
  return new Promise(resolve => {
    s3.listObjectsV2(bucketParams)
      .promise()
      .then(listData => {
        Promise.all(
          listData.Contents.map(content => {
            return s3
              .getObject({
                Bucket: bucketParams.Bucket,
                Key:    content.Key
              })
              .promise()
          })
        ).then(data => {
          data.forEach(file => {
            const key = listData.Contents.find(
              content => content.ETag === file.ETag
            ).Key
            fs.writeFileSync(path.join(destination, key), file.Body)
          })
          if (listData.IsTruncated) {
            bucketParams.ContinuationToken = listData.NextContinuationToken
            downloadCourseRecursive(
              s3,
              bucketParams,
              destination
            ).then(resolve)
          } else {
            resolve()
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
  const contents = fs.readdirSync(source)
  const totalDirectories = contents.filter(file =>
    directoryExists(path.join(source, file))
  ).length
  console.log(`Converting ${totalDirectories} courses to Hugo markdown...`)
  progressBar.start(totalDirectories, 0)
  contents.forEach(file => {
    const coursePath = path.join(source, file)
    if (fs.lstatSync(coursePath).isDirectory()) {
      // If the item is indeed a directory, read all files in it
      scanCourse(coursePath, destination).then(() => {
        progressBar.increment()
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
      } catch (err) {
        loggers.errorLogger.log({
          level:   "error",
          message: err
        })
      }
    })
  }
}

module.exports = {
  downloadCourses,
  scanCourses,
  scanCourse,
  writeMarkdownFilesRecursive
}
