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
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const singleCourseSourcePath = `test_data/${singleCourseId}`
const singleCourseMasterJsonPath = path.join(
  singleCourseSourcePath,
  "e395587c58555f1fe564e8afd75899e6_master.json"
)
const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)

describe("generateMarkdownFromJson", () => {
  it("contains the course home page and other expected sections", () => {
    const singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
      singleCourseJsonData
    )
    const expectedSections = singleCourseJsonData["course_pages"]
      .filter(
        page =>
          page["parent_uid"] === singleCourseJsonData["uid"] &&
          page["type"] !== "CourseHomeSection"
      )
      .map(page => page["short_url"])
    const markdownFileNames = singleCourseMarkdownData.map(markdownData => {
      return markdownData["name"]
    })
    assert.include(markdownFileNames, "_index.md")
    expectedSections.forEach(expectedSection => {
      let filename = `sections/${expectedSection}`
      const sectionMarkdownData = singleCourseMarkdownData.filter(
        section =>
          section["name"] === `${filename}.md` ||
          section["name"] === `${filename}/_index.md`
      )[0]
      const hasChildren = sectionMarkdownData["children"].length > 0
      filename = hasChildren ? `${filename}/_index.md` : `${filename}.md`
      assert.include(markdownFileNames, filename)
      if (hasChildren) {
        const sectionUid = singleCourseJsonData["course_pages"].filter(
          page => page["short_url"] === expectedSection
        )[0]["uid"]
        const childMarkdownFileNames = sectionMarkdownData["children"].map(
          markdownData => {
            return markdownData["name"]
          }
        )
        const expectedChildren = singleCourseJsonData["course_pages"].filter(
          page => page["parent_uid"] === sectionUid
        )
        expectedChildren.forEach(expectedChild => {
          const childFilename = `${helpers.pathToChildRecursive(
            "sections/",
            expectedChild,
            singleCourseJsonData
          )}.md`
          assert.include(childMarkdownFileNames, childFilename)
        })
      }
    })
  })
})

describe("generateCourseHomeFrontMatter", () => {
  let courseHomeFrontMatter,
    getCourseImageUrl,
    getCourseNumber,
    getCourseCollectionObject,
    safeDump
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    getCourseImageUrl = sandbox.spy(helpers, "getCourseImageUrl")
    getCourseNumber = sandbox.spy(helpers, "getCourseNumber")
    getCourseCollectionObject = sandbox.spy(
      helpers,
      "getCourseCollectionObject"
    )
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
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_title property to the title property of the course json data", () => {
    const expectedValue = singleCourseJsonData["title"]
    const foundValue = courseHomeFrontMatter["course_title"]
    assert.equal(expectedValue, foundValue)
  })

  it("calls getCourseImageUrl with the course json data", () => {
    expect(getCourseImageUrl).to.be.calledWithExactly(singleCourseJsonData)
  })

  it("sets the course_image_url property to the value returned from helpers.getCourseImageUrl", () => {
    const expectedValue = helpers.getCourseImageUrl(singleCourseJsonData)
    const foundValue = courseHomeFrontMatter["course_image_url"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_description property to the description property of the course json data", () => {
    const expectedValue = singleCourseJsonData["description"]
    const foundValue = courseHomeFrontMatter["course_description"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the instructors property on the course_info node to the instructors found in the instuctors node of the course json data", () => {
    singleCourseJsonData["instructors"].forEach((instructor, index) => {
      const expectedValue = `Prof. ${instructor["first_name"]} ${instructor["last_name"]}`
      const foundValue =
        courseHomeFrontMatter["course_info"]["instructors"][index]
      assert.equal(expectedValue, foundValue)
    })
  })

  it("sets the department property on the course_info node to the deparentment found on the url property of the course json data, title cased with hyphens replaced with spaces", () => {
    const expectedValue = titleCase.titleCase(
      singleCourseJsonData["url"].split("/")[2].replace(/-/g, " ")
    )
    const foundValue = courseHomeFrontMatter["course_info"]["department"]
    assert.equal(expectedValue, foundValue)
  })

  it("calls getCourseCollectionObject with each of the elements in course_collections", () => {
    singleCourseJsonData["course_collections"].forEach(courseCollection => {
      expect(getCourseCollectionObject).to.be.calledWith(courseCollection)
    })
  })

  it("sets the topics property on the course info object to data parsed from course_collections in the course json data", () => {
    const expectedValues = singleCourseJsonData[
      "course_collections"
    ].map(courseCollection =>
      helpers.getCourseCollectionObject(courseCollection)
    )
    const foundValues = courseHomeFrontMatter["course_info"]["topics"]
    expectedValues.forEach((expectedValue, index) => {
      Object.keys(foundValues[index]).forEach(property => {
        assert.equal(expectedValue[property], foundValues[index][property])
      })
    })
  })

  it("calls getCourseNumber with the course json data", () => {
    expect(getCourseNumber).to.be.calledWithExactly(singleCourseJsonData)
  })

  it("sets the course_number property on the course info object to data parsed from sort_as and extra_course_number properties in the course json data", () => {
    const expectedValue = helpers.getCourseNumber(singleCourseJsonData)
    const foundValue = courseHomeFrontMatter["course_info"]["course_number"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the term property on the course info object to from_semester and from_year in the course json data", () => {
    const expectedValue = `${singleCourseJsonData["from_semester"]} ${singleCourseJsonData["from_year"]}`
    const foundValue = courseHomeFrontMatter["course_info"]["term"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the level property on the course info object to course_level in the course json data", () => {
    const expectedValue = singleCourseJsonData["course_level"]
    const foundValue = courseHomeFrontMatter["course_info"]["level"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the menu index of the course home page to -10 to ensure it is at the top", () => {
    assert.equal(
      -10,
      courseHomeFrontMatter["menu"][singleCourseJsonData["short_url"]]["weight"]
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
        .generateCourseSectionFrontMatter(
          "Syllabus",
          "syllabus",
          null,
          10,
          singleCourseJsonData["short_url"]
        )
        .replace(/---\n/g, "")
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("sets the title property to the title passed in", () => {
    assert.equal("Syllabus", courseSectionFrontMatter["title"])
  })

  it("sets the menu index to 10", () => {
    assert.equal(
      10,
      courseSectionFrontMatter["menu"][singleCourseJsonData["short_url"]][
        "weight"
      ]
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
      const section = helpers.getCourseSectionFromFeatureUrl(courseFeature)
      const matchingSection = singleCourseJsonData["course_pages"].filter(
        coursePage => coursePage["short_url"] === section
      )[0]
      if (section && matchingSection) {
        const sectionPath = helpers.pathToChildRecursive(
          `courses/${singleCourseJsonData["short_url"]}/sections/`,
          matchingSection,
          singleCourseJsonData
        )
        expect(link).to.be.calledWithExactly(
          courseFeature["ocw_feature"],
          `{{% ref "${sectionPath}" %}}`
        )
      }
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
      const collection = helpers.getCourseCollectionText(courseCollection, ">")
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
      )
    )
  })
})
