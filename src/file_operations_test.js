const assert = require("assert")
const expect = require("expect.js")
const { scanCourses } = require("./file_operations")
const fs = require("fs")
const sinon = require("sinon")

describe("scan_courses", () => {
  let readdir, consoleLog

  beforeEach(() => {
    readdir = sinon.stub(fs, "readdir").returns({})
    consoleLog = sinon.stub(console, "log").returns({})
  })
  afterEach(() => {
    readdir.restore()
    consoleLog.restore()
  })

  it("throws an error when you call it with no source directory", () => {
    expect(scanCourses)
      .withArgs(null, "test_data/destination")
      .to.throwError(Error, "Invalid source directory")
  })

  it("throws an error when you call it with no destination directory", () => {
    expect(scanCourses)
      .withArgs("test_data/source", null)
      .to.throwError(Error, "Invalid source directory")
  })

  it("calls readdir once", () => {
    scanCourses("test_data/source", "test_data/destination")
    expect(readdir.calledOnceWith("test_data/source")).to.be(true)
  })

  it("scans the three test courses and reports to console", () => {
    scanCourses("test_data/source", "test_data/destination")
    expect(consoleLog.calledOnceWith("Scanning 3 subdirectories under test_data/source"))
  })
})
