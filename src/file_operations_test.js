#!/usr/bin/env node

const path = require("path")
const { assert } = require("chai")
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
    assert(
      readdirSync.calledOnce,
      "Expected readdirSync to be called once on the source path"
    )
  })

  it("scans the three test courses and reports to console", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    assert(
      consoleLog.calledOnceWith(logMessage),
      `Expected a console.log call saying "${logMessage}"`
    )
  })

  it("calls lstatSync for each test course", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    assert(
      lstatSync.calledWithExactly(course1Path),
      `Expected lstatSync to be called with ${course1Path}`
    )
    assert(
      lstatSync.calledWithExactly(course2Path),
      `Expected lstatSync to be called with ${course2Path}`
    )
    assert(
      lstatSync.calledWithExactly(course3Path),
      `Expected lstatSync to be called with ${course3Path}`
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
    assert(
      readFileSync.calledWithExactly(singleCourseMasterJsonPath),
      `Expected readFileSync to be called with ${singleCourseMasterJsonPath}`
    )
  })

  it("calls generateMarkdownFromJson on the course data", async () => {
    await fileOperations.scanCourse(singleCourseSourcePath, destinationPath)
    assert(
      generateMarkdownFromJson.calledWithExactly(singleCourseJsonData),
      "Expected generateMarkdownFromJson to be called with test course JSON data"
    )
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
        ),
        `Expected writeFileSync for ${file["name"]} not found`
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
        ),
        `Expected unlinkSync for ${file["name"]} not found`
      )
    }
  })
})
