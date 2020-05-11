#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs")
const path = require("path")
const AWS = require("aws-sdk")
const env = require("dotenv").config().parsed
const rimraf = require("rimraf")
const cliProgress = require("cli-progress")

const { directoryExists } = require("./helpers")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)

const downloadCourses = async (coursesJson, coursesDir) => {
  if (!fs.existsSync(coursesJson)) {
    throw new Error("Invalid courses JSON")
  }
  if (!coursesDir) {
    throw new Error("Invalid courses directory")
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
  return await Promise.all(
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
      await downloadCourseRecursive(s3, bucketParams, coursesDir)
      progressBar.increment()
    })
  )
}

const downloadCourseRecursive = async (s3, bucketParams, destination) => {
  const listData = await s3.listObjectsV2(bucketParams).promise()
  const allFiles = await Promise.all(
    listData.Contents.map(async content => {
      return await s3
        .getObject({
          Bucket: bucketParams.Bucket,
          Key:    content.Key
        })
        .promise()
    })
  )
  allFiles.forEach(file => {
    const key = listData.Contents.find(content => content.ETag === file.ETag)
      .Key
    fs.writeFileSync(path.join(destination, key), file.Body)
  })
  if (listData.IsTruncated) {
    bucketParams.ContinuationToken = listData.NextContinuationToken
    await downloadCourseRecursive(s3, bucketParams, destination)
  }
}

module.exports = {
  downloadCourses,
  downloadCourseRecursive
}
