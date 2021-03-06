/* eslint-disable no-console */

const { readFile, stat } = require("./fsPromises")
const path = require("path")
const AWS = require("aws-sdk")
require("dotenv").config()
const cliProgress = require("cli-progress")
const loggers = require("./loggers")

const { createOrOverwriteFile } = require("./helpers")

const progressBar = new cliProgress.SingleBar(
  { stopOnComplete: true },
  cliProgress.Presets.shades_classic
)

const downloadCourses = async (coursesJson, coursesDir) => {
  if (!coursesDir) {
    throw new Error("Invalid courses directory")
  }
  if (!process.env["AWS_BUCKET_NAME"]) {
    throw new Error("AWS_BUCKET_NAME not set")
  }
  let courses
  try {
    courses = JSON.parse(await readFile(coursesJson))["courses"]
  } catch (err) {
    throw new Error(`Invalid courses JSON: ${err}`)
  }
  /**
   * We explicitly configure credentials here if we see them set because
   * the aws-sdk will not automatically configure itself from values set in
   * .env files
   */
  if (
    process.env["AWS_REGION"] &&
    process.env["AWS_ACCESS_KEY"] &&
    process.env["AWS_SECRET_ACCESS_KEY"]
  ) {
    AWS.config = new AWS.Config({
      region:      process.env["AWS_REGION"],
      credentials: new AWS.Credentials({
        accessKeyId:     process.env["AWS_ACCESS_KEY"],
        secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"]
      })
    })
  }

  const s3 = new AWS.S3()
  const totalCourses = courses.length
  console.log(`Downloading ${totalCourses} courses from AWS...`)
  progressBar.start(totalCourses, 0)
  return await Promise.all(
    courses.map(async course => {
      const bucketParams = {
        Bucket: process.env["AWS_BUCKET_NAME"],
        Prefix: course
      }
      await downloadCourseRecursive(s3, bucketParams, coursesDir)
      progressBar.increment()
    })
  )
}

const downloadCourseRecursive = async (s3, bucketParams, destination) => {
  const listData = await s3.listObjectsV2(bucketParams).promise()
  const newFiles = []
  let modifiedFiles = await Promise.all(
    listData.Contents.map(async content => {
      const filePath = path.join(destination, content.Key)
      const getObjectParams = {
        Bucket: bucketParams.Bucket,
        Key:    content.Key
      }
      let mtime
      try {
        mtime = (await stat(filePath)).mtime
      } catch (err) {
        // most likely file does not exist, so download it again
        newFiles.push(await s3.getObject(getObjectParams).promise())
        return null
      }

      if (content.LastModified > mtime) {
        // content is newly updated, so download it again
        return await s3.getObject(getObjectParams).promise()
      }

      // no need for action
      return null
    })
  )
  modifiedFiles = modifiedFiles.filter(file => file)

  const writeS3Object = async file => {
    const contents = listData.Contents.find(
      content => content.ETag === file.ETag
    )
    if (!contents) {
      loggers.fileLogger.error(
        `Unable to find matching etag for ${file.ETag} to be written to ${destination}`
      )
      return null
    }

    await createOrOverwriteFile(path.join(destination, contents.Key), file.Body)
  }

  await Promise.all(modifiedFiles.map(writeS3Object))
  await Promise.all(newFiles.map(writeS3Object))

  if (listData.IsTruncated) {
    bucketParams.ContinuationToken = listData.NextContinuationToken
    await downloadCourseRecursive(s3, bucketParams, destination)
  }
}

module.exports = {
  downloadCourses,
  downloadCourseRecursive
}
