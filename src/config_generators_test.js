const fs = require("fs")
const yaml = require("js-yaml")
const path = require("path")
const sinon = require("sinon")
const { assert } = require("chai").use(require("sinon-chai"))

const { generateMenuItems } = require("./config_generators")
const fileOperations = require("./file_operations")
const { readCourseJson, covidCourseId } = require("./test_utils")

describe("generateMenuItems", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog, courseMenuItems, pathLookup, covidCourseJsonData

  beforeEach(async () => {
    covidCourseJsonData = readCourseJson(covidCourseId)
    consoleLog = sandbox.stub(console, "log")
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [covidCourseId]
    )
    courseMenuItems = generateMenuItems(covidCourseJsonData, pathLookup)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("generates the expected menu for the example course", () => {
    const expectedValue = yaml.safeDump({
      leftnav: [
        {
          identifier: "b6c8c090-d707-9126-837f-7dda4af627c7",
          name:       "Syllabus",
          url:        "/pages/onlinecourse",
          weight:     10
        },
        {
          identifier: "2c792bd7-4590-5d33-6e50-77b0ae1237e1",
          name:       "Calendar",
          url:        "/pages/calendar",
          weight:     20
        },
        {
          name: "Online Publication",
          url:
            "https://biology.mit.edu/undergraduate/current-students/subject-offerings/covid-19-sars-cov-2-and-the-pandemic/",
          weight: 1000
        }
      ]
    })
    assert.equal(expectedValue, courseMenuItems)
  })
})
