#!/usr/bin/env node

const path = require("path")
const { assert } = require("chai")
const markdownGenerators = require("./markdown_generators")
const helpers = require("./helpers")
const fs = require("fs")
const yaml = require("js-yaml")
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
  let courseHomeFrontMatter, getCourseImageUrl
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    getCourseImageUrl = sandbox.spy(helpers, "getCourseImageUrl")
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
    assert.equal(
      courseHomeFrontMatter["title"],
      "Course Home",
      'expected "title" front matter property to be "Course Home"'
    )
  })

  it(`sets the course_title property to the title property of the course json data`, () => {
    assert.equal(
      courseHomeFrontMatter["course_title"],
      singleCourseJsonData["title"],
      'expected "course_title" front matter property to equal the json property "title"'
    )
  })

  it("calls getCourseImageUrl with the course json data", () => {
    assert(
      getCourseImageUrl.calledWithExactly(singleCourseJsonData),
      "expected getCourseImageUrl to be called with the course json data"
    )
  })

  it("sets the course_image_url property to the value returned from helpers.getCourseImageUrl", () => {
    const courseImageUrl = helpers.getCourseImageUrl(singleCourseJsonData)
    assert.equal(
      courseHomeFrontMatter["course_image_url"],
      courseImageUrl,
      `expected "course_image_url" front matter property to be ${courseImageUrl}`
    )
  })
})
