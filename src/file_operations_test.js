#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const tmp = require("tmp")
const rimraf = require("rimraf")
const AWSMock = require("aws-sdk-mock")
const AWS = require("aws-sdk")
AWSMock.setSDKInstance(AWS)

const helpers = require("./helpers")
const fileOperations = require("./file_operations")
const markdownGenerators = require("./markdown_generators")

tmp.setGracefulCleanup()
const singleCourseId =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const singleCourseSourcePath = `test_data/${singleCourseId}`
const singleCourseMasterJsonPath = path.join(
  singleCourseSourcePath,
  "e395587c58555f1fe564e8afd75899e6_master.json"
)
const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)
const singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
  singleCourseJsonData
)

describe("downloadCourses", () => {
  const testCoursesJson = "test_data/courses.json"
  const coursesDir = tmp.dirSync({ prefix: "source" }).name

  it("throws an error when you call it with no courses.json", () => {
    assert.throws(() => fileOperations.downloadCourses(null, coursesDir))
  })

  it("throws an error when you call it with no coursesDir", () => {
    assert.throws(() => fileOperations.downloadCourses(testCoursesJson, null))
  })
})

describe("downloadCourseRecursive", () => {
  const sandbox = sinon.createSandbox()
  const testCourse = "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
  const testJson = "bb55dad7f4888f0a1ad004600c5fb1f1_master.json"
  const testJsonKey = path.join(testCourse, testJson)
  const testJsonContents = fs.readFileSync(path.join("test_data", testCourse, testJson))
  const coursesDir = tmp.dirSync({ prefix: "source" }).name
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name
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
        Key: testJsonKey,
        LastModified: "2020-03-21T00:47:13.000Z",
        ETag:         "a629d97165f6920838085eeddfccd228",
        Size:         144523,
        StorageClass: "STANDARD"
      }
    ],
    Name:   "open-learning-course-data-ci",
    Prefix: testCourse,
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
  fs.mkdirSync(path.join(coursesDir, testCourse), { recursive: true })
  let mockS3, listObjectsV2Spy, getObjectSpy

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")

    AWSMock.mock("S3", "listObjectsV2", listObjectsV2Output)

    AWSMock.mock("S3", "getObject", getObjectOutput)

    mockS3 = new AWS.S3()
    await fileOperations.downloadCourseRecursive(mockS3, bucketParams, coursesDir)
  })

  afterEach(() => {
    sandbox.restore()
    rimraf.sync(path.join(coursesDir, testCourse))
    fs.mkdirSync(path.join(coursesDir, testCourse), { recursive: true })
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
      Key: testJsonKey
    })
  })
})

describe("scanCourses", () => {
  let readdirSync, lstatSync, consoleLog
  const sandbox = sinon.createSandbox()
  const sourcePath = "test_data"
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name
  const logMessage = "Converting 3 courses to Hugo markdown..."
  const course1Path = path.join(
    sourcePath,
    "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
  )
  const course2Path = path.join(
    sourcePath,
    "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
  )
  const course3Path = path.join(
    sourcePath,
    "3-00-thermodynamics-of-materials-fall-2002"
  )

  beforeEach(() => {
    readdirSync = sandbox.spy(fs, "readdirSync")
    lstatSync = sandbox.spy(fs, "lstatSync")
    consoleLog = sandbox.stub(console, "log")
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("throws an error when you call it with no source directory", () => {
    assert.throws(() => fileOperations.scanCourses(null, destinationPath))
  })

  it("throws an error when you call it with no destination directory", () => {
    assert.throws(() => fileOperations.scanCourses(sourcePath, null))
  })

  it("calls readdirSync once", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    expect(readdirSync).to.be.calledOnce
  })

  it("scans the three test courses and reports to console", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    expect(consoleLog).calledWithExactly(logMessage)
  })

  it("calls lstatSync for each test course", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    expect(lstatSync).to.be.calledWithExactly(course1Path)
    expect(lstatSync).to.be.calledWithExactly(course2Path)
    expect(lstatSync).to.be.calledWithExactly(course3Path)
  })
})

describe("scanCourse", () => {
  let readFileSync, generateMarkdownFromJson
  const sandbox = sinon.createSandbox()
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name

  beforeEach(async () => {
    readFileSync = sandbox.stub(fs, "readFileSync").returns(singleCourseRawData)
    generateMarkdownFromJson = sandbox.spy(
      markdownGenerators,
      "generateMarkdownFromJson"
    )
    await fileOperations.scanCourse(singleCourseSourcePath, destinationPath)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls readFileSync on the master json file", () => {
    expect(readFileSync).to.be.calledWithExactly(singleCourseMasterJsonPath)
  })

  it("calls generateMarkdownFromJson on the course data", () => {
    expect(generateMarkdownFromJson).to.be.calledOnceWithExactly(
      singleCourseJsonData
    )
  })
})

describe("writeMarkdownFilesRecursive", () => {
  let mkDirSync, writeFileSync, unlinkSync
  const sandbox = sinon.createSandbox()
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name

  beforeEach(() => {
    mkDirSync = sandbox.spy(fs, "mkdirSync")
    writeFileSync = sandbox.spy(fs, "writeFileSync")
    unlinkSync = sandbox.spy(fs, "unlinkSync")
    fileOperations.writeMarkdownFilesRecursive(
      path.join(destinationPath, singleCourseId),
      singleCourseMarkdownData
    )
  })

  afterEach(() => {
    sandbox.restore()
    rimraf.sync(path.join(destinationPath, "*"))
  })

  it("calls mkDirSync to create sections folder", () => {
    expect(mkDirSync).to.be.calledWith(
      path.join(destinationPath, singleCourseId, "sections")
    )
  })

  it("calls mkDirSync to create subfolders for sections with children", () => {
    singleCourseMarkdownData
      .filter(file => file["name"] !== "_index.md")
      .forEach(file => {
        if (file["children"].length > 0) {
          const child = singleCourseJsonData["course_pages"].filter(
            page =>
              path.join("sections", page["short_url"], "_index.md") ===
              file["name"]
          )[0]
          expect(mkDirSync).to.be.calledWith(
            helpers.pathToChildRecursive(
              path.join(destinationPath, singleCourseId, "sections"),
              child,
              singleCourseJsonData
            )
          )
        }
      })
  })

  it("calls writeFileSync to create the course section markdown files", () => {
    singleCourseMarkdownData
      .filter(file => file["name"] !== "_index.md")
      .forEach(file => {
        expect(writeFileSync).to.be.calledWithExactly(
          path.join(destinationPath, singleCourseId, file["name"]),
          file["data"]
        )
        if (file["children"].length > 0) {
          file["children"].forEach(child => {
            const childJson = singleCourseJsonData["course_pages"].filter(
              page =>
                `${helpers.pathToChildRecursive(
                  "sections",
                  page,
                  singleCourseJsonData
                )}.md` === child["name"]
            )[0]
            expect(writeFileSync).to.be.calledWithExactly(
              `${helpers.pathToChildRecursive(
                path.join(destinationPath, singleCourseId, "sections"),
                childJson,
                singleCourseJsonData
              )}.md`,
              child["data"]
            )
          })
        }
      })
  })

  it("calls unlinkSync to remove files if they already exist", () => {
    fileOperations.writeMarkdownFilesRecursive(
      path.join(destinationPath, singleCourseId),
      singleCourseMarkdownData
    )
    singleCourseMarkdownData
      .filter(file => file["name"] !== "_index.md")
      .forEach(file => {
        expect(unlinkSync).to.be.calledWithExactly(
          path.join(destinationPath, singleCourseId, file["name"])
        )
        if (file["children"].length > 0) {
          file["children"].forEach(child => {
            const childJson = singleCourseJsonData["course_pages"].filter(
              page =>
                `${helpers.pathToChildRecursive(
                  "sections",
                  page,
                  singleCourseJsonData
                )}.md` === child["name"]
            )[0]
            expect(unlinkSync).to.be.calledWithExactly(
              `${helpers.pathToChildRecursive(
                path.join(destinationPath, singleCourseId, "sections"),
                childJson,
                singleCourseJsonData
              )}.md`
            )
          })
        }
      })
  })
})
