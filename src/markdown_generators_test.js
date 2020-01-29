#!/usr/bin/env node

const path = require("path")
const { assert } = require("chai")
const markdownGenerators = require("./markdown_generators")
const fs = require("fs")
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
