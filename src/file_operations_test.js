#!/usr/bin/env node

const path = require("path")
const chai = require("chai")
const assert = chai.assert
const fileOperations = require("./file_operations")
const fs = require("fs")
const sinon = require("sinon")
const tmp = require("tmp")
tmp.setGracefulCleanup()

describe("scanCourses", () => {
  let readdirSyncSpy, lstatSyncSpy, consoleLogStub, scanCourseSpy
  const sandbox = sinon.createSandbox()
  const sourcePath = "test_data"
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name

  beforeEach(() => {
    readdirSyncSpy = sandbox.spy(fs, "readdirSync")
    lstatSyncSpy = sandbox.spy(fs, "lstatSync")
    consoleLogStub = sandbox.spy(console, "log")
    scanCourseSpy = sandbox.spy(fileOperations, "scanCourse")
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
    assert(readdirSyncSpy.calledOnce)
  })

  it("scans the three test courses and reports to console", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    assert(
      consoleLogStub.calledOnceWith("Scanning 3 subdirectories under test_data")
    )
  })

  it("calls lstatSync for each test course", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    assert(
      lstatSyncSpy.calledWithExactly(
        path.join(
          sourcePath,
          "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
        )
      )
    )
    assert(
      lstatSyncSpy.calledWithExactly(
        path.join(
          sourcePath,
          "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
        )
      )
    )
    assert(
      lstatSyncSpy.calledWithExactly(
        path.join(sourcePath, "3-00-thermodynamics-of-materials-fall-2002")
      )
    )
  })
})

describe("scanCourse", () => {
  let readdir, readFileSync, writeFileSync, writeMarkdownFiles
  const sourcePath =
    "test_data/1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
  const masterJsonPath = path.join(
    sourcePath,
    "bb55dad7f4888f0a1ad004600c5fb1f1_master.json"
  )
  const masterJsonCourseData = fs.readFileSync(masterJsonPath)
  const destinationPath = tmp.dirSync({ prefix: "destination" }).name
  const expectedSections = [
    "syllabus",
    "instructor-insights",
    "readings",
    "lecture-notes",
    "recitations",
    "assignments",
    "exams",
    "tools",
    "download-course-materials"
  ]

  beforeEach(() => {
    readFileSync = sinon.stub(fs, "readFileSync").returns(masterJsonCourseData)
    writeFileSync = sinon.stub(fs, "writeFileSync")
    writeMarkdownFiles = sinon.stub(fileOperations, "writeMarkdownFiles")
  })

  afterEach(() => {
    readFileSync.restore()
    writeFileSync.restore()
    writeMarkdownFiles.restore()
  })

  it("calls readFileSync on the master json file", async () => {
    await fileOperations.scanCourse(sourcePath, destinationPath)
    assert(readFileSync.calledWithExactly(masterJsonPath))
  })
})
