const fs = require("fs")
const yaml = require("js-yaml")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))

const { generateMenuItems } = require("./config_generators")
const fileOperations = require("./file_operations")

const testDataPath = "test_data/courses"
const singleCourseId = "7-00-covid-19-sars-cov-2-and-the-pandemic-fall-2020"
const singleCourseParsedJsonPath = path.join(
  testDataPath,
  singleCourseId,
  `${singleCourseId}_parsed.json`
)
const singleCourseRawData = fs.readFileSync(singleCourseParsedJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)

describe("generateMenuItems", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog, courseMenuItems, pathLookup

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [singleCourseId]
    )
    courseMenuItems = generateMenuItems(singleCourseJsonData, pathLookup)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("generates the expected menu for the example course", () => {
    const expectedValue = yaml.safeDump({
      leftnav: [
        {
          identifier: "b6c8c090d7079126837f7dda4af627c7",
          name:       "Syllabus",
          url:        "/sections/onlinecourse",
          weight:     10
        },
        {
          identifier: "2c792bd745905d336e5077b0ae1237e1",
          name:       "Calendar",
          url:        "/sections/calendar",
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
