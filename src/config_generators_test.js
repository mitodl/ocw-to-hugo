const fs = require("fs")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))

const { generateExternalLinksMenu } = require("./config_generators")

const testDataPath = "test_data/courses"
const singleCourseId = "7-00-covid-19-sars-cov-2-and-the-pandemic-fall-2020"
const singleCourseParsedJsonPath = path.join(
  testDataPath,
  singleCourseId,
  `${singleCourseId}_parsed.json`
)
const singleCourseRawData = fs.readFileSync(singleCourseParsedJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)

describe("generateExternalLinksMenu", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog, courseExternalLinksMenu

  beforeEach(() => {
    consoleLog = sandbox.stub(console, "log")
    courseExternalLinksMenu = generateExternalLinksMenu(singleCourseJsonData)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("generates the expected menu for the example course", () => {
    const expectedValue = `[[leftnav]]\n\tname = "Online Publication"\n\turl = "https://biology.mit.edu/undergraduate/current-students/subject-offerings/covid-19-sars-cov-2-and-the-pandemic/"\n\tweight = 1000`
    assert.equal(expectedValue, courseExternalLinksMenu)
  })
})
