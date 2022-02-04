const fs = require('fs')
const path = require('path')

const yargs = require('yargs')
const AWS = require("aws-sdk")
const csvParse = require('csv-parse')
const _ = require('lodash')
require("dotenv").config()

const { directoryExists, createOrOverwriteFile } = require('../helpers')

const options = yargs
  .usage("Usage: -o <path>")
  .option("i", {
    alias:        "input",
    describe:     "Input directory of datafiles",
    type:         "string",
    demandOption: true
  })
  .option("o", {
    alias:        "output",
    describe:     "Output directory",
    type:         "string",
    demandOption: true
  })
  .option("d", {
    alias:    "download",
    describe:
      "If true, will download course list from AWS. Else, must have aws_file_list.json in the -i directory.",
    type:         "boolean",
    demandOption: false,
    default:      false
  })
  .argv

const assertEnvVariablesExist = names => {
  const missing = names.filter(name => !process.env[name])
  if (missing.length === 0) return
  throw new Error(`Missing required environment variables: ${missing}`)
}

const getS3Instance = () => {
  assertEnvVariablesExist(['COURSE_CHECK_AWS_REGION', 'COURSE_CHECK_AWS_SECRET_KEY', 'COURSE_CHECK_AWS_ACCESS_KEY_ID'])
  const {
    COURSE_CHECK_AWS_REGION: region,
    COURSE_CHECK_AWS_SECRET_KEY: secretAccessKey,
    COURSE_CHECK_AWS_ACCESS_KEY_ID: accessKeyId
  } = process.env

  AWS.config = new AWS.Config({
    region,
    credentials: new AWS.Credentials({
      accessKeyId, 
      secretAccessKey
    })
  })

  return new AWS.S3()
}

const writeS3CourseFileList = async outPath => {
  const s3 = getS3Instance()
  assertEnvVariablesExist(['COURSE_CHECK_AWS_BUCKET_NAME'])
  const { COURSE_CHECK_AWS_BUCKET_NAME: bucket } = process.env

  const all = []

  let iteration = 0
  let continuationToken = null

  do {
    const { Contents: contents, NextContinuationToken } = await s3.listObjectsV2({
      Bucket:            bucket,
      ContinuationToken: continuationToken,
    }).promise()
    continuationToken = NextContinuationToken
    all.push(...contents.map(c => ({ key: c.Key, lastModified: c.LastModified })))
    iteration++
    if (iteration % 10 === 0) {
      console.log(iteration)
    }
  } while (continuationToken)

  await createOrOverwriteFile(outPath, JSON.stringify(all))
}

const gets3FileList = async (inDirPath, outDirPath, download) => {
  if (!download) {
    const inFile = `${inDirPath}/s3_coursefile_keylist.json`
    try {
      return require(inFile)
    } catch {
      throw new Error(`${inFile} appears not to exist. Please specify --download true.`)
    }
  }
  await writeS3CourseFileList(`${outDirPath}/s3_coursefile_keylist.json`)
  return require(`${outDirPath}/s3_coursefile_keylist.json`)
}

const S3_KEY_TO_COURSE_NAME_REGEXP = /.*\/(?<courseName>.*)\/\d+\/\d+\.json$/
const getFormattedS3Files = async (inDirPath, outDirPath, download)  => {
  const raws3FileList = await gets3FileList(inDirPath, outDirPath, download)
  return raws3FileList.map(row => {
    const { courseName = null } = row.key.match(S3_KEY_TO_COURSE_NAME_REGEXP)?.groups ?? {}
    return {
      ...row,
      courseName
    }
  })
}

const getFormattedPloneCourseList = inFilePath => {
  const formattedData = []
  return new Promise((resolve, reject) => {
    fs.createReadStream(inFilePath)
      .pipe(csvParse.parse({delimiter: ',', columns: true}))
      .on('data', function(row) {
        formattedData.push(formatCourseListRow(row))
      })
      .on('end',function() {
      //do something with csvData
        resolve(formattedData)
      })
      .on("error", error => reject(error))
  })
}

const formatCourseListRow = row => {
  const isLive = live => {
    if (live === 'Yes') return true
    if (live === 'No') return false
    throw new Error('Unexpected value for "live"')
  }

  const formatted = {
    isLive:     isLive(row['Is It Live?']),
    url:        row.URL,
    courseName:    _.last(row.URL.split('/')),
    id:         row['Course Unique ID'].trim()
  }
  if (Object.values(formatted).some(f => f === undefined)) {
    throw new Error('Unexpected missing value in course list csv')
  }
  return formatted
}

const compareLists = (s3FileList, ploneCourseList, env = 'PROD') => {
  const envFileList = s3FileList.filter(r => r.key.startsWith(env))
  const s3Courses = new Set(envFileList.map(r => r.courseName))
  const liveMissing = ploneCourseList.filter(c => c.isLive && !s3Courses.has(c.courseName))
  console.log('Live courses missing from s3 backups:')
  console.log(liveMissing)

  const liveCourses = new Set(ploneCourseList.filter(c => c.isLive).map(c => c.courseName))
  const nonCourseFiles = envFileList.filter(f => !liveCourses.has(f.courseName))
}


const validateDirectoryAccess = async dirpath => {
  const canAccess = await directoryExists(dirpath)
  if (canAccess) return
  throw new Error(`Cannot access directory: ${dirpath}`)
}

const run = async () => {
  const { input, output, download } = options
  const inPath = path.join(process.cwd(), input)
  const outPath = path.join(process.cwd(), output)

  await Promise.all([inPath, outPath].map(validateDirectoryAccess))

  const s3FileList = await getFormattedS3Files(inPath, outPath, download)
  const ploneCourseList = await getFormattedPloneCourseList(path.join(inPath, 'plone_ocw_course_list.csv'))
  compareLists(s3FileList, ploneCourseList)
  return 
}

run()