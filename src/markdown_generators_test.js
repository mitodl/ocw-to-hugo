const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const fs = require("fs")
const yaml = require("js-yaml")
const markdown = require("markdown-doc-builder").default
const titleCase = require("title-case")
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
const singleCourseMasterJsonPath = path.join(
  testDataPath,
  singleCourseId,
  `${singleCourseId}_parsed.json`
)
const imageGalleryCourseMasterJsonPath = path.join(
  testDataPath,
  imageGalleryCourseId,
  `${imageGalleryCourseId}_parsed.json`
)

const videoGalleryCourseMasterJsonPath = path.join(
  testDataPath,
  videoGalleryCourseId,
  `${videoGalleryCourseId}_parsed.json`
)

const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)
const imageGalleryCourseRawData = fs.readFileSync(
  imageGalleryCourseMasterJsonPath
)
const imageGalleryCourseJsonData = JSON.parse(imageGalleryCourseRawData)

const videoGalleryCourseRawData = fs.readFileSync(
  videoGalleryCourseMasterJsonPath
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
const videoGalleryVideos = videoGalleryCourseJsonData["course_files"].filter(
  file => file["parent_uid"] === videoGalleryPages[0]["uid"]
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

  it("doesn't error if the page is missing", () => {
    sandbox.stub(loggers.memoryTransport, "log").callsFake((...args) => {
      throw new Error(`Error caught: ${args}`)
    })
    courseHomeMarkdown = markdownGenerators.generateCourseHomeMarkdown(
      singleCourseJsonData
    )
    assert.include(courseHomeMarkdown, "title: Course Home")
  })

  it("parses the first published date and reformats as ISO-8601", () => {
    courseHomeMarkdown = markdownGenerators.generateCourseHomeMarkdown({
      ...singleCourseJsonData,
      first_published_to_production: "2020/01/30 21:09:39.493 Universal"
    })
    assert.include(courseHomeMarkdown, "publishdate: '2020-01-30T21:09:39")
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
          "Syllabus",
          "syllabus",
          null,
          true,
          false,
          false,
          10,
          false,
          singleCourseJsonData["short_url"],
          singleCourseJsonData
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
          singleCourseJsonData["short_url"],
          singleCourseJsonData
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
          singleCourseJsonData["short_url"],
          singleCourseJsonData
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
      undefined,
      "syllabus",
      null,
      true,
      false,
      false,
      10,
      false,
      singleCourseJsonData["short_url"],
      singleCourseJsonData
    )
    assert.notInclude(yaml, "undefined")
  })

  it("has a course and section title", () => {
    assert.equal(courseSectionFrontMatter["title"], "Syllabus")
    assert.equal(
      courseSectionFrontMatter["course_title"],
      "Exploring Sea, Space, & Earth: Fundamentals of Engineering Design"
    )
  })

  it("has course info", () => {
    const info = courseSectionFrontMatter["course_info"]
    assert.deepEqual(info.instructors, ["Prof. Alexandra Techet"])
    assert.deepEqual(info.departments, [
      "Mechanical Engineering",
      "Aeronautics and Astronautics"
    ])
    assert.deepEqual(info.course_numbers, ["2.00AJ", "16.00AJ"])
    assert.equal(info.term, "Spring 2009")
    assert.equal(info.level, "Undergraduate")
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

describe("turndown tables", () => {
  let markdown
  const tableHTML = `<table summary="See table caption for summary." class="tablewidth100">
    <caption class="invisible">Course readings.</caption> <!-- BEGIN TABLE HEADER (for MIT OCW Table Template 2.51) -->
    <thead>
      <tr>
        <th scope="col">LEC&nbsp;#</th>
        <th scope="col">TOPICS</th>
        <th scope="col">READINGS&nbsp;(3D&nbsp;ED.)</th>
        <th scope="col">READINGS&nbsp;(4TH&nbsp;ED.)</th>
      </tr>
    </thead> <!-- END TABLE HEADER -->
    <tbody>
      <tr class="row">
        <td colspan="4"><strong>Control and Scope</strong></td>
      </tr>
      <tr class="alt-row">
        <td>L 1</td>
        <td>Course Overview, Introduction to Java</td>
        <td>&mdash;</td>
        <td>&mdash;</td>
      </tr>
    </tbody>
  </table>`

  beforeEach(() => {
    markdown = markdownGenerators.turndownService.turndown(tableHTML)
  })

  it("should include a table definition for 4 columns", () => {
    assert.isTrue(markdown.includes("| --- | --- | --- | --- |"))
  })

  it("should properly generate a header with the fullwidth-cell shortcode", () => {
    assert.isTrue(
      markdown.includes(
        "| {{< fullwidth-cell >}}**Control and Scope**{{< /fullwidth-cell >}} | &nbsp; | &nbsp; | &nbsp; |"
      )
    )
  })
})

describe("other turndown elements", () => {
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
    const inputHTML = `<a name="test">test</a>`
    const markdown = markdownGenerators.turndownService.turndown(inputHTML)
    assert.equal(markdown, `{{< anchor "test" >}}test{{< /anchor >}}`)
  })

  it("should generate an anchor shortcode for an a tag with a name and href attribute", () => {
    const inputHTML = `<a name="test" href="https://ocw.mit.edu">test</a>`
    const markdown = markdownGenerators.turndownService.turndown(inputHTML)
    assert.equal(
      markdown,
      `{{< anchor "test" "https://ocw.mit.edu" >}}test{{< /anchor >}}`
    )
  })

  it("should turn inline code blocks into text surrounded by backticks", () => {
    const inputHTML = `<kbd>test</kbd><tt>test</tt><samp>test</samp>`
    const markdown = markdownGenerators.turndownService.turndown(inputHTML)
    assert.equal(markdown, "`test``test``test`")
  })

  it("should return a simplecast shortcode when confronted with a simplecast iframe", () => {
    const inputHTML = `<iframe scrolling="no" seamless="" src="https://player.simplecast.com/e31edbb0-e4ac-4d9f-aebc-3d613c2f972c?dark=false" width="100%" height="200px" frameborder="no"></iframe>`
    const markdown = markdownGenerators.turndownService.turndown(inputHTML)
    assert.equal(
      markdown,
      "{{< simplecast e31edbb0-e4ac-4d9f-aebc-3d613c2f972c >}}"
    )
  })
})
