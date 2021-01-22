const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const fs = require("fs")
const yaml = require("js-yaml")
const markdown = require("markdown-doc-builder").default
const tmp = require("tmp")
tmp.setGracefulCleanup()

const { GETPAGESHORTCODESTART, GETPAGESHORTCODEEND } = require("./constants")
const loggers = require("./loggers")
const markdownGenerators = require("./markdown_generators")
const helpers = require("./helpers")

const testDataPath = "test_data/courses"
const singleCourseId =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const imageGalleryCourseId = "12-001-introduction-to-geology-fall-2013"
const videoGalleryCourseId = "ec-711-d-lab-energy-spring-2011"
const singleCourseParsedJsonPath = path.join(
  testDataPath,
  singleCourseId,
  `${singleCourseId}_parsed.json`
)
const imageGalleryCourseParsedJsonPath = path.join(
  testDataPath,
  imageGalleryCourseId,
  `${imageGalleryCourseId}_parsed.json`
)

const videoGalleryCourseParsedJsonPath = path.join(
  testDataPath,
  videoGalleryCourseId,
  `${videoGalleryCourseId}_parsed.json`
)

const singleCourseRawData = fs.readFileSync(singleCourseParsedJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)
const imageGalleryCourseRawData = fs.readFileSync(
  imageGalleryCourseParsedJsonPath
)
const imageGalleryCourseJsonData = JSON.parse(imageGalleryCourseRawData)

const videoGalleryCourseRawData = fs.readFileSync(
  videoGalleryCourseParsedJsonPath
)
const videoGalleryCourseJsonData = JSON.parse(videoGalleryCourseRawData)

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
const videoGalleryPages = videoGalleryCourseJsonData["course_pages"].filter(
  page => page["is_media_gallery"]
)

const courseImageFeaturesFrontMatter = markdownGenerators.generateCourseFeaturesMarkdown(
  imageGalleryPages[0],
  imageGalleryCourseJsonData
)

const courseVideoFeaturesFrontMatter = markdownGenerators.generateCourseFeaturesMarkdown(
  videoGalleryPages[0],
  videoGalleryCourseJsonData
)

describe("generateMarkdownFromJson", () => {
  const singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
    singleCourseJsonData
  )
  const assertCourseIdRecursive = (sectionMarkdownData, courseId) => {
    const sectionFrontMatter = yaml.safeLoad(
      sectionMarkdownData["data"].split("---\n")[1]
    )
    assert.equal(sectionFrontMatter["course_id"], courseId)
    if (sectionMarkdownData["files"]) {
      sectionMarkdownData["files"].forEach(file => {
        const fileFrontMatter = yaml.safeLoad(file["data"].split("---\n")[1])
        assert.equal(fileFrontMatter["course_id"], courseId)
      })
    }
    if (sectionMarkdownData["media"]) {
      sectionMarkdownData["media"].forEach(media => {
        const mediaFrontMatter = yaml.safeLoad(media["data"].split("---\n")[1])
        assert.equal(mediaFrontMatter["course_id"], courseId)
      })
    }
    if (sectionMarkdownData["children"]) {
      sectionMarkdownData["children"].forEach(child => {
        assertCourseIdRecursive(child, courseId)
      })
    }
  }

  it("contains the course home page and other expected sections", () => {
    const markdownFileNames = singleCourseMarkdownData.map(markdownData => {
      return markdownData["name"]
    })
    assert.include(markdownFileNames, "_index.md")
    const expectedSections = singleCourseJsonData["course_pages"]
      .filter(
        page =>
          page["parent_uid"] === singleCourseJsonData["uid"] &&
          page["type"] !== "CourseHomeSection" &&
          page["type"] !== "SRHomePage" &&
          page["type"] !== "DownloadSection"
      )
      .map(page => page["short_url"])
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

  it("puts the course_id in every course page's markdown", () => {
    singleCourseMarkdownData.forEach(sectionMarkdownData => {
      assertCourseIdRecursive(sectionMarkdownData, singleCourseId)
    })
  })

  it("sets the instructor_insights layout on Instructor Insights pages", () => {
    const markdownData = markdownGenerators.generateMarkdownFromJson(
      imageGalleryCourseJsonData
    )
    markdownData.forEach(sectionMarkdownData => {
      const frontMatter = yaml.safeLoad(
        sectionMarkdownData["data"].split("---\n")[1]
      )
      if (frontMatter["uid"] === "1c2cb2ad1c70fd66f19e20103dc94595") {
        assert.equal(frontMatter["layout"], "instructor_insights")
        sectionMarkdownData["children"].forEach(child => {
          const childFrontMatter = yaml.safeLoad(
            child["data"].split("---\n")[1]
          )
          assert.equal(childFrontMatter["layout"], "instructor_insights")
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

  it(`sets the title of the page to an empty string for course pages`, () => {
    const expectedValue = ""
    const foundValue = courseHomeFrontMatter["title"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the uid property to the uid of the course home page from the source data", () => {
    const expectedValue = "42664d52bd9a5b1632bac20876dc344d"
    const foundValue = courseHomeFrontMatter["uid"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the topics property on the course info object to data parsed from course_collections in the course json data", () => {
    const topics = helpers.getConsolidatedTopics(
      singleCourseJsonData["course_collections"]
    )
    assert.deepEqual(topics, [
      {
        topic:     "Engineering",
        subtopics: [
          {
            specialities: ["Systems Design"],
            subtopic:     "Systems Engineering"
          },
          {
            specialities: ["Robotics and Control Systems"],
            subtopic:     "Electrical Engineering"
          },
          {
            specialities: ["Ocean Exploration"],
            subtopic:     "Ocean Engineering"
          },
          {
            specialities: ["Mechanical Design"],
            subtopic:     "Mechanical Engineering"
          }
        ]
      }
    ])
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

  it("doesn't error if the page is missing", () => {
    sandbox.stub(loggers.memoryTransport, "log").callsFake((...args) => {
      throw new Error(`Error caught: ${args}`)
    })
    courseHomeMarkdown = markdownGenerators.generateCourseHomeMarkdown(
      singleCourseJsonData
    )
    assert.include(courseHomeMarkdown, "title: ''")
  })

  it("handles an empty string for instructors", () => {
    markdownGenerators.generateCourseHomeMarkdown({
      ...singleCourseJsonData,
      instructors: ""
    })
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
          "course_section",
          "Syllabus",
          "syllabus",
          null,
          true,
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
          "course_section",
          "Syllabus",
          "syllabus",
          null,
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
          "course_section",
          "Syllabus",
          "syllabus",
          null,
          true,
          false,
          10,
          false,
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

  it("handles missing short_page_title correctly", async () => {
    const yaml = markdownGenerators.generateCourseSectionFrontMatter(
      "Syllabus",
      "course_section",
      "Syllabus",
      "syllabus",
      null,
      true,
      false,
      10,
      false,
      singleCourseJsonData["short_url"]
    )
    assert.notInclude(yaml, "undefined")
  })

  it("has a section title", () => {
    assert.equal(courseSectionFrontMatter["title"], "Syllabus")
  })
})

describe("generateCourseFeatures", () => {
  let courseFeatures, builderStub, h5, link, ul, sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    builderStub = markdown.newBuilder()

    h5 = sandbox.spy(builderStub, "h5")
    link = sandbox.spy(builderStub, "link")
    ul = sandbox.spy(builderStub, "list")

    sandbox.stub(markdown, "newBuilder").returns(builderStub)
    courseFeatures = markdownGenerators.generateCourseFeatures(
      singleCourseJsonData
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls markdown.h5 to create the Course Features header", () => {
    expect(h5).to.be.calledWithExactly("Course Features")
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

  it("should strip pre-escaped backticks from markdown", () => {
    assert(
      !markdownGenerators
        .generateCourseSectionMarkdown(
          coursePagesWithText[0],
          singleCourseJsonData
        )
        .includes("\\`")
    )
  })

  it("renders markdown for top and bottom text", () => {
    const page = {
      ...coursePagesWithText[0],
      text:       '<div id="top">Top Text</div>',
      bottomtext: '<div id="bottom">Bottom Text</div>'
    }
    const markdown = markdownGenerators.generateCourseSectionMarkdown(
      page,
      singleCourseJsonData
    )
    assert(markdown.includes("Top Text"))
    assert(markdown.includes("Bottom Text"))
  })

  it("handles missing page text gracefully", () => {
    const page = {
      ...coursePagesWithText[0],
      text:       undefined,
      bottomtext: undefined
    }
    const markdown = markdownGenerators.generateCourseSectionMarkdown(
      page,
      singleCourseJsonData
    )
    assert.equal(markdown, "")
  })
})

describe("generateCourseFeaturesMarkdown", () => {
  it("renders one image-gallery shortcode", () => {
    assert.equal(
      (courseImageFeaturesFrontMatter.match(/{{< image-gallery id=/g) || [])
        .length,
      1
    )
  })

  it("renders 11 image-gallery-item shortcodes", () => {
    assert.equal(
      (courseImageFeaturesFrontMatter.match(/{{< image-gallery-item /g) || [])
        .length,
      11
    )
  })

  it("renders the expected files from course_files", () => {
    imageGalleryImages.forEach(image => {
      const url = image["file_location"]
      const fileName = url.substring(url.lastIndexOf("/") + 1, url.length)
      assert.include(courseImageFeaturesFrontMatter, fileName)
    })
  })

  it("renders 2 video-gallery-item shortcodes", () => {
    assert.equal(
      (courseVideoFeaturesFrontMatter.match(/{{< video-gallery-item /g) || [])
        .length,
      2
    )
  })
})
