const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const fs = require("fs")
const yaml = require("js-yaml")
const markdown = require("markdown-doc-builder").default
const tmp = require("tmp")
tmp.setGracefulCleanup()

const loggers = require("./loggers")
const markdownGenerators = require("./markdown_generators")
const helpers = require("./helpers")
const fileOperations = require("./file_operations")

const testDataPath = "test_data/courses"
const singleCourseId =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const imageGalleryCourseId = "12-001-introduction-to-geology-fall-2013"
const videoGalleryCourseId = "ec-711-d-lab-energy-spring-2011"
const physicsCourseId = "8-02-physics-ii-electricity-and-magnetism-spring-2007"
const subtitlesCourseId = "21g-107-chinese-i-streamlined-fall-2014"
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
const physicsCourseParsedJsonPath = path.join(
  testDataPath,
  physicsCourseId,
  `${physicsCourseId}_parsed.json`
)
const subtitlesCourseParsedJsonPath = path.join(
  testDataPath,
  subtitlesCourseId,
  `${subtitlesCourseId}_parsed.json`
)

describe("markdown generators", () => {
  let singleCourseRawData,
    singleCourseJsonData,
    imageGalleryCourseRawData,
    imageGalleryCourseJsonData,
    videoGalleryCourseRawData,
    videoGalleryCourseJsonData,
    physicsCourseRawData,
    physicsCourseJsonData,
    subtitlesCourseRawData,
    subtitlesCourseJsonData,
    coursePagesWithText,
    imageGalleryPages,
    imageGalleryImages,
    videoGalleryPages,
    courseImageFeaturesFrontMatter,
    courseVideoFeaturesFrontMatter,
    pathLookup

  beforeEach(async () => {
    singleCourseRawData = fs.readFileSync(singleCourseParsedJsonPath)
    singleCourseJsonData = JSON.parse(singleCourseRawData)
    imageGalleryCourseRawData = fs.readFileSync(
      imageGalleryCourseParsedJsonPath
    )
    imageGalleryCourseJsonData = JSON.parse(imageGalleryCourseRawData)

    videoGalleryCourseRawData = fs.readFileSync(
      videoGalleryCourseParsedJsonPath
    )
    videoGalleryCourseJsonData = JSON.parse(videoGalleryCourseRawData)

    physicsCourseRawData = fs.readFileSync(physicsCourseParsedJsonPath)
    physicsCourseJsonData = JSON.parse(physicsCourseRawData)

    subtitlesCourseRawData = fs.readFileSync(subtitlesCourseParsedJsonPath)
    subtitlesCourseJsonData = JSON.parse(subtitlesCourseRawData)

    coursePagesWithText = singleCourseJsonData["course_pages"].filter(
      page => page["text"]
    )
    imageGalleryPages = imageGalleryCourseJsonData["course_pages"].filter(
      page => page["is_image_gallery"]
    )
    imageGalleryImages = imageGalleryCourseJsonData["course_files"].filter(
      file =>
        file["type"] === "OCWImage" &&
        file["parent_uid"] === imageGalleryPages[0]["uid"]
    )
    videoGalleryPages = videoGalleryCourseJsonData["course_pages"].filter(
      page => page["is_media_gallery"]
    )

    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [
        singleCourseId,
        videoGalleryCourseId,
        imageGalleryCourseId,
        physicsCourseId,
        subtitlesCourseId
      ]
    )
    courseImageFeaturesFrontMatter = markdownGenerators.generateCourseFeaturesMarkdown(
      imageGalleryPages[0],
      imageGalleryCourseJsonData,
      pathLookup
    )

    courseVideoFeaturesFrontMatter = markdownGenerators.generateCourseFeaturesMarkdown(
      videoGalleryPages[0],
      videoGalleryCourseJsonData,
      pathLookup
    )
    helpers.runOptions.strips3 = false
    helpers.runOptions.staticPrefix = ""
  })

  describe("generateMarkdownFromJson", () => {
    let singleCourseMarkdownData
    beforeEach(() => {
      singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
        singleCourseJsonData,
        pathLookup
      )
    })
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
          const mediaFrontMatter = yaml.safeLoad(
            media["data"].split("---\n")[1]
          )
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
            const childFilename = path.join(
              "sections/",
              expectedChild["url"].split("/")[4],
              "river-testing-photos.md"
            )
            assert.include(childMarkdownFileNames, childFilename)
          })
          expectedFiles.forEach(expectedFile => {
            const fragment = singleCourseJsonData["course_pages"].filter(
              coursePage => coursePage["short_url"] === expectedSection
            )[0]
            const fragmentUrlPieces = fragment.url.split("/")
            const fileFilename = path.join(
              "sections",
              fragmentUrlPieces[fragmentUrlPieces.length - 1],
              `${expectedFile["id"].replace(".pdf", "")}.md`
            )
            assert.include(fileMarkdownFileNames, fileFilename)
          })
          expectedMedia.forEach(expectedFile => {
            const mediaFilename = `/${path.join(
              "sections/",
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
        imageGalleryCourseJsonData,
        pathLookup
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

    it("sets a parent_title property on second tier pages", () => {
      const markdownData = markdownGenerators.generateMarkdownFromJson(
        imageGalleryCourseJsonData,
        pathLookup
      )
      markdownData.forEach(sectionMarkdownData => {
        const frontMatter = yaml.safeLoad(
          sectionMarkdownData["data"].split("---\n")[1]
        )
        if (frontMatter["uid"] === "eb66e88131e84c5dae78ba67407a1fc6") {
          assert.equal(frontMatter["parent_title"], "Instructor Insights")
        }
      })
    })

    //
    ;[
      [
        true,
        "https://example.com//21g-107-chinese-i-streamlined-fall-2014/acf8cbbcf3ada9e7b0d390c8b4f8b1e6_M_gQolc3clM.pdf"
      ],
      [
        false,
        "https://open-learning-course-data-production.s3.amazonaws.com/21g-107-chinese-i-streamlined-fall-2014/acf8cbbcf3ada9e7b0d390c8b4f8b1e6_M_gQolc3clM.pdf"
      ]
    ].forEach(([useStripS3, expectedUrl]) => {
      it(`resolves urls inside embedded media urls when stripS3=${String(
        useStripS3
      )}`, () => {
        helpers.runOptions.strips3 = useStripS3
        helpers.runOptions.staticPrefix = "https://example.com/"
        const markdownData = markdownGenerators.generateMarkdownFromJson(
          subtitlesCourseJsonData,
          pathLookup
        )

        const embeddedMedia = yaml.safeLoad(
          markdownData[3].media[0].data.split("---\n")[1]
        )
        assert.equal(
          embeddedMedia.embedded_media[6].technical_location,
          expectedUrl
        )
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

    beforeEach(async () => {
      getCourseNumbers = sandbox.spy(helpers, "getCourseNumbers")
      getConsolidatedTopics = sandbox.spy(helpers, "getConsolidatedTopics")
      safeDump = sandbox.spy(yaml, "safeDump")
      const pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        [
          physicsCourseId,
          "8-02x-physics-ii-electricity-magnetism-with-an-experimental-focus-spring-2005"
        ]
      )
      courseHomeMarkdown = markdownGenerators.generateCourseHomeMarkdown(
        physicsCourseJsonData,
        pathLookup
      )
      courseHomeFrontMatter = yaml.safeLoad(
        courseHomeMarkdown.split("---\n")[1]
      )
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
      const expectedValue = "a187a05ae5ef2fb5f508bfce0069138d"
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
              specialities: [
                {
                  speciality: "Systems Design",
                  url:        `/search/?t=${encodeURIComponent("Systems Design")}`
                }
              ],
              subtopic: "Systems Engineering",
              url:      `/search/?t=${encodeURIComponent("Systems Engineering")}`
            },
            {
              specialities: [
                {
                  speciality: "Robotics and Control Systems",
                  url:        `/search/?t=${encodeURIComponent(
                    "Robotics and Control Systems"
                  )}`
                }
              ],
              subtopic: "Electrical Engineering",
              url:      `/search/?t=${encodeURIComponent("Electrical Engineering")}`
            },
            {
              specialities: [
                {
                  speciality: "Ocean Exploration",
                  url:        `/search/?t=${encodeURIComponent("Ocean Exploration")}`
                }
              ],
              subtopic: "Ocean Engineering",
              url:      `/search/?t=${encodeURIComponent("Ocean Engineering")}`
            },
            {
              specialities: [
                {
                  speciality: "Mechanical Design",
                  url:        `/search/?t=${encodeURIComponent("Mechanical Design")}`
                }
              ],
              subtopic: "Mechanical Engineering",
              url:      `/search/?t=${encodeURIComponent("Mechanical Engineering")}`
            }
          ],
          url: `/search/?t=${encodeURIComponent("Engineering")}`
        }
      ])
    })

    it("sets the expected text in other_versions", () => {
      const expectedValue = [
        "[8.02X PHYSICS II: ELECTRICITY & MAGNETISM WITH AN EXPERIMENTAL FOCUS](/courses/8-02x-physics-ii-electricity-magnetism-with-an-experimental-focus-spring-2005) |  SPRING 2005"
      ]
      const foundValue = courseHomeFrontMatter["other_versions"]
      assert.deepEqual(expectedValue, foundValue)
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

  describe("generatePagePdfMarkdown", () => {
    it("creates an acknowledgements.md file", () => {
      const pdfMarkdownFiles = markdownGenerators.generatePagePdfMarkdown(
        physicsCourseJsonData,
        pathLookup
      )
      assert.lengthOf(pdfMarkdownFiles, 180)
      const pdfMarkdownFile = pdfMarkdownFiles[0]
      const fileName = pdfMarkdownFile["name"]
      const markdown = yaml.safeLoad(
        pdfMarkdownFile["data"].replace(/---\n/g, "")
      )
      assert.equal(fileName, "/acknowledgements.md")
      assert.deepEqual(markdown, {
        title:       "acknowledgements.pdf",
        description:
          "This resource contains acknowledgements to the persons who helped build this course.",
        type:          "course",
        layout:        "pdf",
        uid:           "d7d1fabcb57a6d4a9cc96f04348dedfd",
        file_type:     "application/pdf",
        file_location:
          "https://open-learning-course-data-production.s3.amazonaws.com/8-02-physics-ii-electricity-and-magnetism-spring-2007/d7d1fabcb57a6d4a9cc96f04348dedfd_acknowledgements.pdf",
        course_id: "8-02-physics-ii-electricity-and-magnetism-spring-2007"
      })
    })

    it("creates a pdf page for a pdf whose parent is not the course home page", () => {
      const pdfMarkdownFile = markdownGenerators.generatePagePdfMarkdown(
        physicsCourseJsonData,
        pathLookup
      )[1]
      const fileName = pdfMarkdownFile["name"]
      const markdown = yaml.safeLoad(
        pdfMarkdownFile["data"].replace(/---\n/g, "")
      )
      assert.equal(fileName, "/sections/readings/summary_w12d2.md")
      assert.deepEqual(markdown, {
        title:       "summary_w12d2.pdf",
        description:
          "This file talks about how electricity and magnetism interact with each other and also considers finalizing Maxwell?s Equations, their result ? electromagnetic (EM) radiation and how energy flows in electric and magnetic fields.",
        type:          "course",
        layout:        "pdf",
        uid:           "a1bfc34ccf08ddf8474627b9a13d6ca8",
        file_type:     "application/pdf",
        file_location:
          "https://open-learning-course-data-production.s3.amazonaws.com/8-02-physics-ii-electricity-and-magnetism-spring-2007/a1bfc34ccf08ddf8474627b9a13d6ca8_summary_w12d2.pdf",
        course_id: "8-02-physics-ii-electricity-and-magnetism-spring-2007"
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
            null,
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
      assert.equal(10, courseSectionFrontMatter["menu"]["leftnav"]["weight"])
    })

    it("calls yaml.safeDump once", () => {
      expect(safeDump).to.be.calledOnce
    })

    it("doesn't create a menu entry if list_in_left_nav is false and it's not a root section", () => {
      courseSectionFrontMatter = yaml.safeLoad(
        markdownGenerators
          .generateCourseSectionFrontMatter(
            "Syllabus",
            null,
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
            null,
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
      assert.equal(10, courseSectionFrontMatter["menu"]["leftnav"]["weight"])
    })

    it("handles missing short_page_title correctly", async () => {
      const yaml = markdownGenerators.generateCourseSectionFrontMatter(
        "Syllabus",
        null,
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
})
