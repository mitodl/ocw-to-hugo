const fs = require("fs")
const moment = require("moment")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const tmp = require("tmp")

const { INPUT_COURSE_DATE_FORMAT } = require("./constants")
const fileOperations = require("./file_operations")
const { generateDataTemplate } = require("./data_template_generators")
const helpers = require("./helpers")

const testDataPath = "test_data/courses"
const singleCourseId =
  "res-ec-001-exploring-fairness-in-machine-learning-for-international-development-spring-2020"
const singleCourseParsedJsonPath = path.join(
  testDataPath,
  singleCourseId,
  `${singleCourseId}_parsed.json`
)
const singleCourseRawData = fs.readFileSync(singleCourseParsedJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)

describe("generateDataTemplate", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog, courseDataTemplate, pathLookup

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [singleCourseId]
    )
    courseDataTemplate = generateDataTemplate(singleCourseJsonData, pathLookup)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("sets the course_id property to the short_url property of the course json data", () => {
    const expectedValue = singleCourseJsonData["short_url"]
    const foundValue = courseDataTemplate["course_id"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_title property to the title property of the course json data", () => {
    const expectedValue = singleCourseJsonData["title"]
    const foundValue = courseDataTemplate["course_title"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_image_url property to the image_src property of the course json data", () => {
    const expectedValue = singleCourseJsonData["image_src"]
    const foundValue = courseDataTemplate["course_image_url"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_thumbnail_image_url property to the thumbnail_image_src property of the course json data", () => {
    const expectedValue = singleCourseJsonData["thumbnail_image_src"]
    const foundValue = courseDataTemplate["course_thumbnail_image_url"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_image_caption_text property to the image_caption_text property of the course json data", () => {
    const expectedValue = singleCourseJsonData["image_caption_text"]
    const foundValue = courseDataTemplate["course_image_caption_text"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the publishdate property to the first_published_to_production property of the course json data", () => {
    const expectedValue = moment(
      singleCourseJsonData["first_published_to_production"],
      INPUT_COURSE_DATE_FORMAT
    ).format()
    const foundValue = courseDataTemplate["publishdate"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the instructors property to the instructors found in the instuctors node of the course json data", () => {
    singleCourseJsonData["instructors"].forEach((instructor, index) => {
      const expectedName = `${
        instructor["salutation"] ? instructor["salutation"] : "Prof."
      } ${instructor["first_name"]} ${instructor["last_name"]}`
      const expectedValue = {
        instructor: expectedName,
        url:        `/search/?q=${encodeURIComponent(`"${expectedName}"`)}`
      }
      const foundValue = courseDataTemplate["instructors"][index]
      assert.deepEqual(expectedValue, foundValue)
    })
  })

  it("sets the department property to the department found on the url property of the course json data, title cased with hyphens replaced with spaces", () => {
    assert.deepEqual(
      [
        {
          department: "Supplemental Resources",
          url:        `/search/?d=${encodeURIComponent("Supplemental Resources")}`
        }
      ],
      courseDataTemplate["departments"]
    )
  })

  it("sets the course_features property to the instructors found in the instuctors node of the course json data", () => {
    singleCourseJsonData["course_feature_tags"].forEach(
      (courseFeature, index) => {
        const expectedValue = helpers.getCourseFeatureObject(
          courseFeature,
          singleCourseJsonData,
          pathLookup
        )
        const foundValue = courseDataTemplate["course_features"][index]
        sinon.assert.match(expectedValue, foundValue)
      }
    )
  })

  it("sets the topics property on the course data template to a consolidated list of topics from the course_collections property of the course json data", () => {
    const expectedValue = helpers.getConsolidatedTopics(
      singleCourseJsonData["course_collections"]
    )[0]
    const foundValue = courseDataTemplate["topics"][0]
    sinon.assert.match(expectedValue, foundValue)
  })

  it("sets the course_number property on the course data template to data parsed from sort_as and extra_course_number properties in the course json data", () => {
    const expectedValue = helpers.getCourseNumbers(singleCourseJsonData)[0]
    const foundValue = courseDataTemplate["course_numbers"][0]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the term property on the course data template to from_semester and from_year in the course json data", () => {
    const expectedValue = `${singleCourseJsonData["from_semester"]} ${singleCourseJsonData["from_year"]}`
    const foundValue = courseDataTemplate["term"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the level property on the course data template to course_level in the course json data", () => {
    const level = singleCourseJsonData["course_level"]
    const foundValue = courseDataTemplate["level"]
    assert.deepEqual(
      {
        level: level,
        url:   "/search/?l=Non%20Credit"
      },
      foundValue
    )
  })
})
