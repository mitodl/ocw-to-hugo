#!/usr/bin/env node

const fs = require("fs")
const tmp = require("tmp")
const rimraf = require("rimraf")
const sinon = require("sinon")
const { assert, expect } = require("chai")
  .use(require("sinon-chai"))
  .use(require("chai-as-promised"))
const path = require("path")
const AWSMock = require("aws-sdk-mock")
const AWS = require("aws-sdk")
AWSMock.setSDKInstance(AWS)

const awsSync = require("./aws_sync")
const fileOperations = require("./file_operations")

describe("downloadCourses", () => {
  const sandbox = sinon.createSandbox()
  const testCoursesJson = "test_data/courses.json"
  const coursesDir = tmp.dirSync({
    prefix: "source"
  }).name
  let consoleLog

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("throws an error when you call it with no courses.json", () => {
    expect(
      awsSync.downloadCourses(null, coursesDir)
    ).to.eventually.be.rejectedWith("Invalid courses JSON")
  })

  it("throws an error when you call it with no coursesDir", () => {
    expect(
      awsSync.downloadCourses(testCoursesJson, null)
    ).to.eventually.be.rejectedWith("Invalid courses directory")
  })
})

describe("downloadCourseRecursive", () => {
  const sandbox = sinon.createSandbox()
  const testCourse =
    "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
  const testJson = "bb55dad7f4888f0a1ad004600c5fb1f1_master.json"
  const testJsonKey = path.join(testCourse, testJson)
  const testJsonContents = fs.readFileSync(
    path.join("test_data", testCourse, testJson)
  )
  const coursesDir = tmp.dirSync({
    prefix: "source"
  }).name
  const destinationPath = tmp.dirSync({
    prefix: "destination"
  }).name
  const outputJsonPath = path.join(coursesDir, testCourse, testJson)
  const bucket = "open-learning-course-data-ci"
  const bucketParams = {
    Bucket: bucket,
    Prefix: testCourse
  }
  const listObjectsV2Output = {
    IsTruncated: false,
    Contents:    [
      {
        Key:          testJsonKey,
        LastModified: "2020-03-21T00:47:13.000Z",
        ETag:         "a629d97165f6920838085eeddfccd228",
        Size:         144523,
        StorageClass: "STANDARD"
      }
    ],
    Name:           "open-learning-course-data-ci",
    Prefix:         testCourse,
    MaxKeys:        1000,
    CommonPrefixes: [],
    KeyCount:       1
  }
  const getObjectOutput = {
    AcceptRanges:  "bytes",
    LastModified:  "2020-03-21T00:47:13.000Z",
    ContentLength: 144523,
    ETag:          "a629d97165f6920838085eeddfccd228",
    VersionId:     "mt5F9IP6xviS16.n.HwOFkldmQGRJb87",
    ContentType:   "binary/octet-stream",
    Metadata:      {},
    Body:          testJsonContents
  }
  fs.mkdirSync(path.join(coursesDir, testCourse), {
    recursive: true
  })
  let mockS3, consoleLog

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")

    AWSMock.mock("S3", "listObjectsV2", listObjectsV2Output)

    AWSMock.mock("S3", "getObject", getObjectOutput)

    mockS3 = new AWS.S3()
    await awsSync.downloadCourseRecursive(mockS3, bucketParams, coursesDir)
  })

  afterEach(() => {
    sandbox.restore()
    rimraf.sync(path.join(coursesDir, testCourse))
    fs.mkdirSync(path.join(coursesDir, testCourse), {
      recursive: true
    })
    AWSMock.restore("S3")
  })

  it("writes the test json file successfully", () => {
    assert.isTrue(fs.existsSync(outputJsonPath))
  })

  it("writes a test json file that matches the one we've fed into the mock", () => {
    assert.deepEqual(testJsonContents, fs.readFileSync(outputJsonPath))
  })

  it("is able to run scanCourses on the resulting courseDir without an error", () => {
    fileOperations.scanCourses(coursesDir, destinationPath)
  })

  it("calls listObjectsV2 with the bucket params", () => {
    expect(mockS3.listObjectsV2).to.be.calledWithExactly(bucketParams)
  })

  it("calls getObject with the bucket and key", () => {
    expect(mockS3.getObject).to.be.calledWithExactly({
      Bucket: bucket,
      Key:    testJsonKey
    })
  })
})
