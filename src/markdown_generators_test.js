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

const { GETPAGESHORTCODESTART, GETPAGESHORTCODEEND } = require("./constants")

const testDataPath = "test_data/courses"
const singleCourseId =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const imageGalleryCourseId = "12-001-introduction-to-geology-fall-2013"
const singleCourseMasterJsonPath = path.join(
  testDataPath,
  singleCourseId,
  "e395587c58555f1fe564e8afd75899e6_master.json"
)
const imageGalleryCourseMasterJsonPath = path.join(
  testDataPath,
  imageGalleryCourseId,
  "d9aad1541f1a9d3c0f7b0dcf9531a9a1_master.json"
)
const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)
const imageGalleryCourseRawData = fs.readFileSync(
  imageGalleryCourseMasterJsonPath
)
const imageGalleryCourseJsonData = JSON.parse(imageGalleryCourseRawData)
const coursePagesWithText = singleCourseJsonData["course_pages"].filter(
  page => page["text"]
)
const imageGalleryPages = imageGalleryCourseJsonData["course_pages"].filter(
  page => page["is_image_gallery"]
)
const imageGalleryImages = imageGalleryCourseJsonData["course_files"].filter(
  file =>
    file["type"] === "OCWImage" &&
    file["parent_uid"] === imageGalleryPages[0]["uid"]
)
const courseFeaturesFrontMatter = markdownGenerators.generateCourseFeaturesMarkdown(
  imageGalleryPages[0],
  imageGalleryCourseJsonData
)

describe("generateMarkdownFromJson", () => {
  it("contains the course home page and other expected sections", () => {
    const singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
      singleCourseJsonData
    )
    const expectedSections = singleCourseJsonData["course_pages"]
      .filter(
        page =>
          page["parent_uid"] === singleCourseJsonData["uid"] &&
          page["type"] !== "CourseHomeSection" &&
          page["type"] !== "DownloadSection"
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
      const hasChildren =
        sectionMarkdownData["children"].length > 0 ||
        sectionMarkdownData["files"].length > 0 ||
        sectionMarkdownData["media"].length > 0
      filename = hasChildren ? `${filename}/_index.md` : `${filename}.md`
      assert.include(markdownFileNames, filename)
      if (hasChildren) {
        const sectionUid = singleCourseJsonData["course_pages"].filter(
          page => page["short_url"] === expectedSection
        )[0]["uid"]
        const childMarkdownFileNames = sectionMarkdownData["children"].map(
          markdownData => markdownData["name"]
        )
        const fileMarkdownFileNames = sectionMarkdownData["files"].map(
          markdownData => markdownData["name"]
        )
        const mediaMarkdownFileNames = sectionMarkdownData["media"].map(
          markdownData => markdownData["name"]
        )
        const expectedChildren = singleCourseJsonData["course_pages"].filter(
          page => page["parent_uid"] === sectionUid
        )
        const expectedFiles = singleCourseJsonData["course_files"].filter(
          file =>
            file["parent_uid"] === sectionUid &&
            file["file_type"] === "application/pdf"
        )
        const expectedMedia = Object.values(
          singleCourseJsonData["course_embedded_media"]
        ).filter(embeddedMedia => embeddedMedia["parent_uid"] === sectionUid)
        expectedChildren.forEach(expectedChild => {
          const childFilename = `${helpers.pathToChildRecursive(
            "sections/",
            expectedChild,
            singleCourseJsonData
          )}.md`
          assert.include(childMarkdownFileNames, childFilename)
        })
        expectedFiles.forEach(expectedFile => {
          const fileFilename = `${path.join(
            helpers.pathToChildRecursive(
              "sections/",
              singleCourseJsonData["course_pages"].filter(
                coursePage => coursePage["short_url"] === expectedSection
              )[0],
              singleCourseJsonData
            ),
            expectedFile["id"].replace(".pdf", "")
          )}.md`
          assert.include(fileMarkdownFileNames, fileFilename)
        })
        expectedMedia.forEach(expectedFile => {
          const mediaFilename = `${path.join(
            helpers.pathToChildRecursive(
              "sections/",
              singleCourseJsonData["course_pages"].filter(
                coursePage => coursePage["short_url"] === expectedSection
              )[0],
              singleCourseJsonData
            ),
            expectedFile["short_url"]
          )}.md`
          assert.include(mediaMarkdownFileNames, mediaFilename)
        })
      }
    })
  })
})

describe("generateCourseHomeMarkdown", () => {
  let courseHomeMarkdown,
    courseHomeFrontMatter,
    getCourseNumbers,
    getConsolidatedTopics,
    safeDump
  const sandbox = sinon.createSandbox()

  beforeEach(() => {
    getCourseNumbers = sandbox.spy(helpers, "getCourseNumbers")
    getConsolidatedTopics = sandbox.spy(helpers, "getConsolidatedTopics")
    safeDump = sandbox.spy(yaml, "safeDump")
    courseHomeMarkdown = markdownGenerators.generateCourseHomeMarkdown(
      singleCourseJsonData
    )
    courseHomeFrontMatter = yaml.safeLoad(courseHomeMarkdown.split("---\n")[1])
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

  it("sets the course_image_url property to the image_src of the course json data", () => {
    const expectedValue = singleCourseJsonData["image_src"]
    const foundValue = courseHomeFrontMatter["course_image_url"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_thumbnail_image_url property to the thumbnail_image_src of the course json data", () => {
    const expectedValue = singleCourseJsonData["thumbnail_image_src"]
    const foundValue = courseHomeFrontMatter["course_thumbnail_image_url"]
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
    assert.equal(
      "Mechanical Engineering",
      courseHomeFrontMatter["course_info"]["departments"][0]
    )
    assert.equal(
      "Aeronautics and Astronautics",
      courseHomeFrontMatter["course_info"]["departments"][1]
    )
  })

  it("calls getConsolidatedTopics with course_collections", () => {
    expect(getConsolidatedTopics).to.be.calledWith(
      singleCourseJsonData["course_collections"]
    )
  })

  it("sets the topics property on the course info object to data parsed from course_collections in the course json data", () => {
    const expectedValues = helpers.getConsolidatedTopics(
      singleCourseJsonData["course_collections"]
    )
    const foundValues = courseHomeFrontMatter["course_info"]["topics"]
    Object.keys(expectedValues).forEach(expectedTopicKey => {
      assert.isTrue(foundValues.hasOwnProperty(expectedTopicKey))
      Object.keys(expectedValues[expectedTopicKey]).forEach(
        expectedSubTopicKey => {
          assert.isTrue(
            foundValues[expectedTopicKey].hasOwnProperty(expectedSubTopicKey)
          )
          expectedValues[expectedTopicKey][expectedSubTopicKey].forEach(
            (expectedSpeciality, index) => {
              assert.equal(
                expectedSpeciality,
                foundValues[expectedTopicKey][expectedSubTopicKey][index]
              )
            }
          )
        }
      )
    })
  })

  it("calls getCourseNumbers with the course json data", () => {
    expect(getCourseNumbers).to.be.calledWithExactly(singleCourseJsonData)
  })

  it("sets the course_number property on the course info object to data parsed from sort_as and extra_course_number properties in the course json data", () => {
    const expectedValue = helpers.getCourseNumbers(singleCourseJsonData)[0]
    const foundValue = courseHomeFrontMatter["course_info"]["course_numbers"][0]
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
          "Syllabus",
          "syllabus",
          null,
          true,
          false,
          false,
          10,
          false,
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

  it("doesn't create a menu entry if list_in_left_nav is false and it's not a root section", () => {
    courseSectionFrontMatter = yaml.safeLoad(
      markdownGenerators
        .generateCourseSectionFrontMatter(
          "Syllabus",
          "Syllabus",
          "syllabus",
          null,
          false,
          false,
          false,
          10,
          false,
          singleCourseJsonData["short_url"]
        )
        .replace(/---\n/g, "")
    )
    expect(courseSectionFrontMatter["menu"]).to.be.undefined
  })

  it("creates a menu entry if list_in_left_nav is true and it's not a root section", () => {
    courseSectionFrontMatter = yaml.safeLoad(
      markdownGenerators
        .generateCourseSectionFrontMatter(
          "Syllabus",
          "Syllabus",
          "syllabus",
          null,
          false,
          false,
          false,
          10,
          true,
          singleCourseJsonData["short_url"]
        )
        .replace(/---\n/g, "")
    )
    assert.equal(
      10,
      courseSectionFrontMatter["menu"][singleCourseJsonData["short_url"]][
        "weight"
      ]
    )
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

describe("generateCourseSectionMarkdown", () => {
  it("can be called without generating an error and returns something", () => {
    assert(
      markdownGenerators.generateCourseSectionMarkdown(
        coursePagesWithText[0],
        singleCourseJsonData
      )
    )
  })
})

describe("generateCourseFeaturesMarkdown", () => {
  it("renders one image-gallery shortcode", () => {
    assert.equal(
      (courseFeaturesFrontMatter.match(/{{< image-gallery id=/g) || []).length,
      1
    )
  })

  it("renders 11 image-gallery-item shortcodes", () => {
    assert.equal(
      (courseFeaturesFrontMatter.match(/{{< image-gallery-item /g) || [])
        .length,
      11
    )
  })

  it("renders the expected files from course_files", () => {
    imageGalleryImages.forEach(image => {
      const url = image["file_location"]
      const fileName = url.substring(url.lastIndexOf("/") + 1, url.length)
      assert.include(courseFeaturesFrontMatter, fileName)
    })
  })
})

describe("turndown service", () => {
  it("should not get tripped up on problematic code blocks", () => {
    const problematicHTML =
      "<pre><span><code>stuff\nin\nthe\nblock</span></pre>"
    const markdown = markdownGenerators.turndownService.turndown(
      problematicHTML
    )
    assert.equal(markdown, "```\nstuff\nin\nthe\nblock\n```")
  })

  it("should properly escape square brackets inside link text", () => {
    const problematicHTML = `<a href="${GETPAGESHORTCODESTART}courses/${singleCourseId}/syllabus${GETPAGESHORTCODEEND}">[R&amp;T]</a>`
    const markdown = markdownGenerators.turndownService.turndown(
      problematicHTML
    )
    assert.equal(
      markdown,
      `[\\[R&T\\]]({{% getpage "courses/2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009/syllabus" %}})`
    )
  })

  it("should generate an anchor shortcode for an a tag with a name attribute", () => {
    const inputHTML = `<a name="test"></a>`
    const markdown = markdownGenerators.turndownService.turndown(inputHTML)
    assert.equal(markdown, `{{< anchor "test" >}}`)
  })
})
