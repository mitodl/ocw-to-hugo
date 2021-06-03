const fs = require("fs")
const yaml = require("js-yaml")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))

const {
  generateExternalLinksMenu,
  generateHugoConfig
} = require("./config_generators")

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
  let consoleLog, courseHugoConfig, courseExternalLinksMenu

  beforeEach(() => {
    consoleLog = sandbox.stub(console, "log")
    courseHugoConfig = generateHugoConfig()
    courseExternalLinksMenu = generateExternalLinksMenu(singleCourseJsonData)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("generates the expected Hugo config file", () => {
    const expectedValue = yaml.safeDump({
      baseUrl:      "/",
      languageCode: "en-us",
      title:        "MIT OpenCourseWare",
      theme:        ["base-theme", "course"]
    })
    assert.equal(expectedValue, courseHugoConfig)
  })

  it("generates the expected menu for the example course", () => {
    const expectedValue = yaml.safeDump({
      leftnav: [
        {
          name: "Online Publication",
          url:
            "https://biology.mit.edu/undergraduate/current-students/subject-offerings/covid-19-sars-cov-2-and-the-pandemic/",
          weight: 1000
        }
      ]
    })
    assert.equal(expectedValue, courseExternalLinksMenu)
  })
})
