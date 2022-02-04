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
  assertEnvVariablesExist(['DUPLICATES_CHECK_AWS_REGION', 'DUPLICATES_CHECK_AWS_SECRET_KEY', 'DUPLICATES_CHECK_AWS_ACCESS_KEY_ID'])
  const {
    DUPLICATES_CHECK_AWS_REGION: region,
    DUPLICATES_CHECK_AWS_SECRET_KEY: secretAccessKey,
    DUPLICATES_CHECK_AWS_ACCESS_KEY_ID: accessKeyId
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

const getCombinedMetaFromS3 = async outPath => {
  const s3 = getS3Instance()
  assertEnvVariablesExist(['DUPLICATES_CHECK_AWS_BUCKET_NAME'])
  const { DUPLICATES_CHECK_AWS_BUCKET_NAME: bucket } = process.env

  const parsed = []

  let iteration = 0
  let continuationToken = null
  const fileDownloads = []
  do {
    const { Contents: contents, NextContinuationToken } = await s3.listObjectsV2({
      Bucket:            bucket,
      ContinuationToken: continuationToken,
    }).promise()
    continuationToken = NextContinuationToken
    const keys = contents
      .map(c => c.Key)
      .filter(key => key.endsWith('_parsed') || key.endsWith('_parsed.json'))
    const newDownloads = keys.map(async key => {
      const file = await s3.getObject({ Key: key, Bucket: bucket }).promise()
      return { file, key }
    })
    fileDownloads.push(...newDownloads)
    if (iteration % 10 === 0) {
      console.log(iteration)
    }
    iteration++
  } while (continuationToken)

  const files = await Promise.all(fileDownloads)
  const keepFields = [
    "uid",
    "title",
    "first_published_to_production", 
    "last_published_to_production",
    "last_unpublishing_date",
    "retirement_date",
  ]
  const combined = files.reduce((acc, { file, key }) => {
    acc[key] = _.pick(JSON.parse(file.Body.toString()), keepFields)
    return acc
  }, {})
  await createOrOverwriteFile(outPath, JSON.stringify(combined))
}

const getCombinedMeta = async (inDirPath, outDirPath, download) => {
  const inPath = path.join(inDirPath, 'combined_meta.json')
  const outPath = path.join(outDirPath, 'combined_meta.json')
  try {
    return require(inPath)
  } catch(err) {
    if (!download) throw err
    await getCombinedMetaFromS3(outPath)
    return require(outPath)
  }
}

const run = async () => {
  const { input, output, download } = options
  const inDirPath = path.join(process.cwd(), input)
  const outDirPath = path.join(process.cwd(), output)

  const combinedMeta = await getCombinedMeta(inDirPath, outDirPath, download)
  const duplicates = _.chain(combinedMeta)
    .mapValues((value, key) => ({...value, key}))
    .groupBy(m => m.uid)
    .pickBy(group => group.length > 1)
    .mapValues(group => _.orderBy(group, entry => {
      const dateString = entry.last_published_to_production.endsWith(' Universal')
        ? entry.last_published_to_production.match(/(?<dateString>.*) Universal/).groups.dateString
        : entry.last_published_to_production
      const date = new Date(dateString)
      return date.getTime()
    }, 'desc'))
    .value()
  
  Object.values(duplicates).forEach(
    group => group.forEach(entry => {
      console.log(entry.key.split('/')[0])
    })
  )

  return 
}

run()