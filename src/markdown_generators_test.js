#!/usr/bin/env node

const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const markdownGenerators = require("./markdown_generators")
const helpers = require("./helpers")
const fs = require("fs")
const yaml = require("js-yaml")
const markdown = require("markdown-builder")
const titleCase = require("title-case")
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
  let courseHomeFrontMatter,
    getCourseImageUrl,
    getCourseNumber,
    makeTopic,
    safeDump
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    getCourseImageUrl = sandbox.spy(helpers, "getCourseImageUrl")
    getCourseNumber = sandbox.spy(helpers, "getCourseNumber")
    makeTopic = sandbox.spy(helpers, "makeTopic")
    safeDump = sandbox.spy(yaml, "safeDump")
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
    expect(getCourseImageUrl).to.be.calledWithExactly(singleCourseJsonData)
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
    expect(getCourseNumber).to.be.calledWithExactly(singleCourseJsonData)
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

  it("sets the term property on the course info object to from_semester and from_year in the course json data", () => {
    const expectedValue = `${singleCourseJsonData["from_semester"]} ${singleCourseJsonData["from_year"]}`
    const foundValue = courseHomeFrontMatter["course_info"]["term"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })

  it("sets the level property on the course info object to course_level in the course json data", () => {
    const expectedValue = singleCourseJsonData["course_level"]
    const foundValue = courseHomeFrontMatter["course_info"]["level"]
    assert.equal(
      expectedValue,
      foundValue,
      `expected ${expectedValue} to equal ${foundValue}`
    )
  })

  it("sets the menu index of the course home page to -10 to ensure it is at the top", () => {
    assert.equal(
      -10,
      courseHomeFrontMatter["menu"]["main"]["weight"],
      "expected main menu weight to be -10"
    )
  })

  it("calls yaml.safeDump once", () => {
    expect(safeDump).to.be.calledOnce
  })
})

describe("generateCourseSectionFrontMatter", () => {
  let courseSectionFrontMatter, safeDump
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    safeDump = sandbox.spy(yaml, "safeDump")
    courseSectionFrontMatter = yaml.safeLoad(
      markdownGenerators
        .generateCourseSectionFrontMatter("Syllabus", 10)
        .replace(/---\n/g, "")
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("sets the title property to the title passed in", () => {
    assert.equal(
      "Syllabus",
      courseSectionFrontMatter["title"],
      "expected the title property to be Syllabus"
    )
  })

  it("sets the menu index to 10", () => {
    assert.equal(
      10,
      courseSectionFrontMatter["menu"]["main"]["weight"],
      "expected main menu weight to be 10"
    )
  })

  it("calls yaml.safeDump once", () => {
    expect(safeDump).to.be.calledOnce
  })
})

describe("generateCourseFeatures", () => {
  let courseFeatures, hX, link, ul
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    hX = sandbox.spy(markdown.headers, "hX")
    link = sandbox.spy(markdown.misc, "link")
    ul = sandbox.spy(markdown.lists, "ul")
    courseFeatures = markdownGenerators.generateCourseFeatures(
      singleCourseJsonData
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls markdown.headers.hx to create the Course Features header", () => {
    expect(hX).to.be.calledWithExactly(5, "Course Features")
  })

  it("calls markdown.misc.link for each item in course_features", () => {
    singleCourseJsonData["course_features"].forEach(courseFeature => {
      const url = helpers.getCourseSectionFromFeatureUrl(courseFeature)
      expect(link).to.be.calledWithExactly(courseFeature["ocw_feature"], url)
    })
  })

  it("calls markdown.lists.ul to create the Course Features list", () => {
    expect(ul).to.be.calledOnce
  })
})

describe("generateCourseCollections", () => {
  let courseCollections, hX, link, ul
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    hX = sandbox.spy(markdown.headers, "hX")
    link = sandbox.spy(markdown.misc, "link")
    ul = sandbox.spy(markdown.lists, "ul")
    courseCollections = markdownGenerators.generateCourseCollections(
      singleCourseJsonData
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls markdown.headers.hx to create the Course Collections header", () => {
    expect(hX).to.be.calledWithExactly(5, "Course Collections")
  })

  it("calls markdown.misc.link for each item in course_collections", () => {
    singleCourseJsonData["course_collections"].forEach(courseCollection => {
      const collection = helpers.getCourseCollectionText(courseCollection)
      expect(link).to.be.calledWithExactly(collection, "#")
    })
  })

  it("calls markdown.lists.ul to create the Course Features list", () => {
    expect(ul).to.be.calledOnce
  })
})

describe("generateCourseSectionMarkdown", () => {
  it("can be called without generating an error and returns something", () => {
    const coursePagesWithText = singleCourseJsonData["course_pages"].filter(
      page => page["text"]
    )
    assert(
      markdownGenerators.generateCourseSectionMarkdown(
        coursePagesWithText[0],
        singleCourseJsonData
      ),
      "expected generateCourseSectionMarkdown to run without errors and return a value"
    )
  })
})
