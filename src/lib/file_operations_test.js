const assert = require("assert")
const { AssertionError } = require("assert")
const fs = require("fs")
const { scanCourses } = require("./file_operations")

describe("scanCourses no arguments", () => {
  it("test that calling scanCourses with no arguments throws an error", () => {
    try {
      scanCourses()
      assert.fail("Expected exception not thrown")
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e
      }
      assert.equal(e.message, "Invalid source directory and destination directory")
    }
  })
})

describe("scanCourses no source", () => {
  it("test that calling scanCourses with no source throws an error", () => {
    try {
      scanCourses(null, "./test_output")
      assert.fail("Expected exception not thrown")
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e
      }
      assert.equal(e.message, "Invalid source directory")
    }
  })
})

describe("scanCourses no destination", () => {
  it("test that calling scanCourses with no destination throws an error", () => {
    try {
      scanCourses("./test_data", null)
      assert.fail("Expected exception not thrown")
    } catch (e) {
      if (e instanceof AssertionError) {
        throw e
      }
      assert.equal(e.message, "Invalid destination directory")
    }
  })
})
