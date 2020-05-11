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

const downloadCourses = (coursesJson, coursesDir) => {
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
            downloadCourseRecursive(s3, bucketParams, destination).then(resolve)
          } else {
            resolve()
          }
        })
      })
  })
}

module.exports = {
  downloadCourses,
  downloadCourseRecursive
}
