const assert = require("assert")
const path = require("path")
const expect = require("expect.js")
const fileOperations = require("./file_operations")
const fs = require("fs")
const sinon = require("sinon")

describe("scanCourses", () => {
  let readdir, consoleLog, scanCourseStub
  const sourcePath = "test_data/source"
  const destinationPath = "test_data/destination"

  beforeEach(() => {
    readdir = sinon.stub(fs, "readdir").returns({})
    consoleLog = sinon.spy(console, "log")
    scanCourseStub = sinon.stub(fileOperations, "scanCourse").returns({})
  })

  afterEach(() => {
    readdir.restore()
    consoleLog.restore()
    scanCourseStub.restore()
  })

  it("throws an error when you call it with no source directory", () => {
    expect(fileOperations.scanCourses)
      .withArgs(null, destinationPath)
      .to.throwError(Error, "Invalid source directory")
  })

  it("throws an error when you call it with no destination directory", () => {
    expect(fileOperations.scanCourses)
      .withArgs(sourcePath, null)
      .to.throwError(Error, "Invalid source directory")
  })

  it("calls readdir once", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    expect(readdir.calledOnceWith(sourcePath)).to.be(true)
  })

  it("scans the three test courses and reports to console", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    expect(
      consoleLog.calledOnceWith(
        "Scanning 3 subdirectories under test_data/source"
      )
    )
  })

  it("calls scanCourse for each test course", () => {
    fileOperations.scanCourses(sourcePath, destinationPath)
    expect(
      scanCourseStub.calledOnceWith(
        "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012",
        destinationPath
      )
    )
    expect(
      scanCourseStub.calledOnceWith(
        "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009",
        destinationPath
      )
    )
    expect(
      scanCourseStub.calledOnceWith(
        "3-00-thermodynamics-of-materials-fall-2002",
        destinationPath
      )
    )
  })
})

describe("scanCourse", () => {
  let readdir, readFileSync, writeFileSync
  const sourcePath =
    "test_data/source/1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
  const masterJsonPath = path.join(
    sourcePath,
    "bb55dad7f4888f0a1ad004600c5fb1f1_master.json"
  )
  const destinationPath = "test_data/destination"

  beforeEach(() => {
    readdir = sinon.stub(fs, "readdir").returns({})
    readFileSync = sinon
      .stub(fs, "readFileSync")
      .returns(fs.readFileSync(masterJsonPath))
    writeFileSync = sinon.stub(fs, "writeFileSync")
  })

  afterEach(() => {
    readdir.restore()
    readFileSync.restore()
    writeFileSync.restore()
  })

  it("calls readdir once", () => {
    fileOperations.scanCourse(sourcePath, destinationPath)
    expect(readdir.calledOnceWith(sourcePath)).to.be(true)
  })

  it("calls fs.readFileSync for the master.json file", () => {
    fileOperations.scanCourse(sourcePath, destinationPath)
    expect(readFileSync.calledOnceWith(masterJsonPath)).to.be(true)
  })
})
