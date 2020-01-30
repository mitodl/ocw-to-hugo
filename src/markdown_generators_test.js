#!/usr/bin/env node

const path = require("path")
const { assert } = require("chai")
const markdownGenerators = require("./markdown_generators")
const helpers = require("./helpers")
const fs = require("fs")
const yaml = require("js-yaml")
const titleCase = require("title-case")
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

describe("generateMarkdownFromJson", () => {
  it("contains the course home page and other expected sections", () => {
    const singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
      singleCourseJsonData
    )
    const expectedSections = singleCourseJsonData["course_pages"]
      .filter(page => page["text"])
      .map(page => page["short_url"])
    const sections = singleCourseMarkdownData.map(section => {
      return section["name"]
    })
    assert(
      sections.includes("_index.md"),
      "expected _index.md to be in the markdown data"
    )
    expectedSections.forEach(expectedSection => {
      const fileName = `sections/${expectedSection}.md`
      assert(
        sections.includes(fileName),
        `expected ${fileName} to be in the markdown data`
      )
    })
  })
})

describe("generateCourseHomeFrontMatter", () => {
  let courseHomeFrontMatter, getCourseImageUrl, getCourseNumber, makeTopic
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    getCourseImageUrl = sandbox.spy(helpers, "getCourseImageUrl")
    getCourseNumber = sandbox.spy(helpers, "getCourseNumber")
    makeTopic = sandbox.spy(helpers, "makeTopic")
    courseHomeFrontMatter = yaml.safeLoad(
      markdownGenerators
        .generateCourseHomeFrontMatter(singleCourseJsonData)
        .replace(/---\n/g, "")
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it(`sets the title of the page to "Course Home"`, () => {
    const expectedValue = "Course Home"
    const foundValue = courseHomeFrontMatter["title"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })

  it("sets the course_title property to the title property of the course json data", () => {
    const expectedValue = singleCourseJsonData["title"]
    const foundValue = courseHomeFrontMatter["course_title"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })

  it("calls getCourseImageUrl with the course json data", () => {
    assert(
      getCourseImageUrl.calledWithExactly(singleCourseJsonData),
      "expected getCourseImageUrl to be called with the course json data"
    )
  })

  it("sets the course_image_url property to the value returned from helpers.getCourseImageUrl", () => {
    const expectedValue = helpers.getCourseImageUrl(singleCourseJsonData)
    const foundValue = courseHomeFrontMatter["course_image_url"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })

  it("sets the course_description property to the description property of the course json data", () => {
    const expectedValue = singleCourseJsonData["description"]
    const foundValue = courseHomeFrontMatter["course_description"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })

  it("sets the instructors property on the course_info node to the instructors found in the instuctors node of the course json data", () => {
    singleCourseJsonData["instructors"].forEach((instructor, index) => {
      const expectedValue = `Prof. ${instructor["first_name"]} ${instructor["last_name"]}`
      const foundValue =
        courseHomeFrontMatter["course_info"]["instructors"][index]
      assert(
        expectedValue === foundValue,
        `expected ${expectedValue} to equal ${foundValue}`
      )
    })
  })

  it("sets the department property on the course_info node to the deparentment found on the url property of the course json data, title cased with hyphens replaced with spaces", () => {
    const expectedValue = titleCase.titleCase(
      singleCourseJsonData["url"].split("/")[2].replace(/-/g, " ")
    )
    const foundValue = courseHomeFrontMatter["course_info"]["department"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })

  it("calls makeTopic with each of the elements in course_collections", () => {
    const courseCollectionsLength =
      singleCourseJsonData["course_collections"].length
    assert.equal(
      makeTopic.callCount,
      courseCollectionsLength,
      `expected makeTopic to be called ${courseCollectionsLength} times`
    )
  })

  it("sets the topics property on the course info object to data parsed from course_collections in the course json data", () => {
    const expectedValues = singleCourseJsonData["course_collections"].map(
      helpers.makeTopic
    )
    const foundValues = courseHomeFrontMatter["course_info"]["topics"]
    expectedValues.forEach((expectedValue, index) => {
      assert.equal(
        expectedValue,
        foundValues[index],
        `expected ${expectedValue} to equal ${foundValues[index]}`
      )
    })
  })

  it("calls getCourseNumber with the course json data", () => {
    assert(
      getCourseNumber.calledWithExactly(singleCourseJsonData),
      "expected getCourseNumber to be called with the course json data"
    )
  })

  it("sets the course_number property on the course info object to data parsed from sort_as and extra_course_number properties in the course json data", () => {
    const expectedValue = helpers.getCourseNumber(singleCourseJsonData)
    const foundValue = courseHomeFrontMatter["course_info"]["course_number"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })
})
