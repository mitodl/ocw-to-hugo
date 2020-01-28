#!/usr/bin/env node

const path = require("path")
const chai = require("chai")
const assert = chai.assert
const fileOperations = require("./file_operations")
const markdownGenerators = require("./markdown_generators")
const fs = require("fs")
const sinon = require("sinon")
const tmp = require("tmp")
tmp.setGracefulCleanup()

const singleCourseId =
  "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
const singleCourseSourcePath = `test_data/${singleCourseId}`
const singleCourseMasterJsonPath = path.join(
  singleCourseSourcePath,
  "bb55dad7f4888f0a1ad004600c5fb1f1_master.json"
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

  beforeEach(() => {
    readdirSync = sandbox.spy(fs, "readdirSync")
    lstatSync = sandbox.spy(fs, "lstatSync")
    consoleLog = sandbox.spy(console, "log")
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("throws an error when you call it with no source directory", () => {
    try {
      fileOperations.scanCourses(null, destinationPath)
    } catch (err) {
      assert.equal(err.message, "Invalid source directory")
    }
  })

  it("throws an error when you call it with no destination directory", () => {
    try {
      fileOperations.scanCourses(sourcePath, null)
    } catch (err) {
      assert.equal(err.message, "Invalid destination directory")
    }
  })

  it("calls readdirSync once", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    assert(readdirSync.calledOnce)
  })

  it("scans the three test courses and reports to console", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    assert(
      consoleLog.calledOnceWith("Scanning 3 subdirectories under test_data")
    )
  })

  it("calls lstatSync for each test course", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    assert(
      lstatSync.calledWithExactly(
        path.join(
          sourcePath,
          "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
        )
      )
    )
    assert(
      lstatSync.calledWithExactly(
        path.join(
          sourcePath,
          "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
        )
      )
    )
    assert(
      lstatSync.calledWithExactly(
        path.join(sourcePath, "3-00-thermodynamics-of-materials-fall-2002")
      )
    )
  })
})

describe("scanCourse", () => {
  let readFileSync, generateMarkdownFromJson
  const sandbox = sinon.createSandbox()
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name

  beforeEach(() => {
    readFileSync = sandbox.stub(fs, "readFileSync").returns(singleCourseRawData)
    generateMarkdownFromJson = sandbox.spy(
      markdownGenerators,
      "generateMarkdownFromJson"
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls readFileSync on the master json file", async () => {
    await fileOperations.scanCourse(singleCourseSourcePath, destinationPath)
    assert(readFileSync.calledWithExactly(singleCourseMasterJsonPath))
  })

  it("calls generateMarkdownFromJson on the course data", async () => {
    await fileOperations.scanCourse(singleCourseSourcePath, destinationPath)
    assert(generateMarkdownFromJson.calledOnce)
  })
})

describe("writeMarkdownFiles", () => {
  let mkDirSync, writeFileSync, unlinkSync
  const sandbox = sinon.createSandbox()
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name

  beforeEach(() => {
    mkDirSync = sandbox.spy(fs, "mkdirSync")
    writeFileSync = sandbox.spy(fs, "writeFileSync")
    unlinkSync = sandbox.spy(fs, "unlinkSync")
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls mkDirSync to create sections folder", () => {
    fileOperations.writeMarkdownFiles(
      singleCourseId,
      singleCourseMarkdownData,
      destinationPath
    )
    mkDirSync.calledWithExactly(
      path.join(destinationPath, singleCourseId, "sections")
    )
  })

  it("calls writeFileSync to create the course section markdown files", () => {
    fileOperations.writeMarkdownFiles(
      singleCourseId,
      singleCourseMarkdownData,
      destinationPath
    )
    for (const file of singleCourseMarkdownData) {
      assert(
        writeFileSync.calledWithExactly(
          path.join(destinationPath, singleCourseId, file["name"]),
          file["data"]
        )
      )
    }
  })

  it("calls unlinkSync to remove files if they already exist", () => {
    fileOperations.writeMarkdownFiles(
      singleCourseId,
      singleCourseMarkdownData,
      destinationPath
    )
    fileOperations.writeMarkdownFiles(
      singleCourseId,
      singleCourseMarkdownData,
      destinationPath
    )
    for (const file of singleCourseMarkdownData) {
      assert(
        unlinkSync.calledWithExactly(
          path.join(destinationPath, singleCourseId, file["name"])
        )
      )
    }
  })
})
