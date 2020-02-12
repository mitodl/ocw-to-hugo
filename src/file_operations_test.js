#!/usr/bin/env node

const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const fileOperations = require("./file_operations")
const markdownGenerators = require("./markdown_generators")
const fs = require("fs")
const tmp = require("tmp")
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

describe("scanCourses", () => {
  let readdirSync, lstatSync, consoleLog
  const sandbox = sinon.createSandbox()
  const sourcePath = "test_data"
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name
  const logMessage = "Scanning 3 subdirectories under test_data"
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
  })

  it("calls mkDirSync to create sections folder", () => {
    expect(mkDirSync).to.be.calledWith(
      path.join(destinationPath, singleCourseId, "sections")
    )
  })

  it("calls writeFileSync to create the course section markdown files", () => {
    for (const file of singleCourseMarkdownData) {
      expect(writeFileSync).to.be.calledWithExactly(
        path.join(destinationPath, singleCourseId, file["name"]),
        file["data"]
      )
    }
  })

  it("calls unlinkSync to remove files if they already exist", () => {
    fileOperations.writeMarkdownFilesRecursive (
      path.join(destinationPath, singleCourseId),
      singleCourseMarkdownData
    )
    for (const file of singleCourseMarkdownData) {
      expect(unlinkSync).to.be.calledWithExactly(
        path.join(destinationPath, singleCourseId, file["name"])
      )
    }
  })
})
