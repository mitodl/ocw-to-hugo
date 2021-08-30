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
    let videoGalleryCourseMarkdownData
    beforeEach(() => {
      videoGalleryCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
        videoGalleryCourseJsonData,
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
      const markdownFileNames = videoGalleryCourseMarkdownData.map(
        markdownData => {
          return markdownData["name"]
        }
      )
      const expectedSections = singleCourseJsonData["course_pages"]
        .filter(
          page =>
            page["parent_uid"] === videoGalleryCourseJsonData["uid"] &&
            page["type"] !== "CourseHomeSection" &&
            page["type"] !== "SRHomePage" &&
            page["type"] !== "DownloadSection"
        )
        .map(page => page["short_url"])
      expectedSections.forEach(expectedSection => {
        let filename = `pages/${expectedSection}`
        const sectionMarkdownData = videoGalleryCourseMarkdownData.filter(
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
          const sectionUid = videoGalleryCourseJsonData["course_pages"].filter(
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
          const expectedChildren = videoGalleryCourseJsonData[
            "course_pages"
          ].filter(page => page["parent_uid"] === sectionUid)
          const expectedFiles = videoGalleryCourseJsonData[
            "course_files"
          ].filter(
            file =>
              file["parent_uid"] === sectionUid &&
              file["file_type"] === "application/pdf"
          )
          const expectedMedia = Object.values(
            videoGalleryCourseJsonData["course_embedded_media"]
          ).filter(embeddedMedia => embeddedMedia["parent_uid"] === sectionUid)
          expectedChildren.forEach(expectedChild => {
            const isParent =
              videoGalleryCourseJsonData["course_pages"].filter(
                coursePage => coursePage["parent_uid"] === expectedChild["uid"]
              ).length > 0
            const hasFiles =
              videoGalleryCourseJsonData["course_files"].filter(
                file =>
                  file["file_type"] === "application/pdf" &&
                  file["parent_uid"] === expectedChild["uid"]
              ).length > 0
            const hasMedia =
              Object.values(
                videoGalleryCourseJsonData["course_embedded_media"]
              ).filter(
                courseEmbeddedMedia =>
                  courseEmbeddedMedia["parent_uid"] === expectedChild["uid"]
              ).length > 0
            const pathToChild = helpers.stripSlashPrefix(
              pathLookup.byUid[expectedChild["uid"]].path
            )
            const childFilename =
              isParent || hasFiles || hasMedia
                ? path.join(pathToChild, "_index.md")
                : `${pathToChild}.md`
            assert.include(childMarkdownFileNames, childFilename)
          })
          expectedFiles.forEach(expectedFile => {
            const fileFilename = `${helpers.stripSlashPrefix(
              helpers.stripPdfSuffix(pathLookup.byUid[expectedFile["uid"]].path)
            )}.md`
            assert.include(fileMarkdownFileNames, fileFilename)
          })
          expectedMedia.forEach(expectedFile => {
            const mediaFilename = `${helpers.stripSlashPrefix(
              pathLookup.byUid[expectedFile["uid"]].path
            )}.md`
            assert.include(mediaMarkdownFileNames, mediaFilename)
          })
        }
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

    it("sets a parent_uid and parent_title property on second tier pages", () => {
      const markdownData = markdownGenerators.generateMarkdownFromJson(
        imageGalleryCourseJsonData,
        pathLookup
      )
      markdownData.forEach(sectionMarkdownData => {
        const frontMatter = yaml.safeLoad(
          sectionMarkdownData["data"].split("---\n")[1]
        )
        if (
          frontMatter["uid"] === "1c2cb2ad1c70fd66f19e20103dc94595" &&
          sectionMarkdownData["children"].length > 0
        ) {
          sectionMarkdownData["children"].forEach(childSection => {
            const childFrontMatter = yaml.safeLoad(
              childSection["data"].split("---\n")[1]
            )
            assert.equal(
              childFrontMatter["parent_uid"],
              "1c2cb2ad1c70fd66f19e20103dc94595"
            )
            assert.equal(
              childFrontMatter["parent_title"],
              "Instructor Insights"
            )
          })
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
          markdownData[2].media[0].data.split("---\n")[1]
        )
        assert.equal(
          embeddedMedia.embedded_media[6].technical_location,
          expectedUrl
        )
      })
    })
  })

  describe("getConsolidatedTopics", () => {
    let getConsolidatedTopics, safeDump
    const sandbox = sinon.createSandbox()

    beforeEach(async () => {
      getConsolidatedTopics = sandbox.spy(helpers, "getConsolidatedTopics")
      safeDump = sandbox.spy(yaml, "safeDump")
    })

    afterEach(() => {
      sandbox.restore()
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
        layout:        "pdf",
        uid:           "d7d1fabcb57a6d4a9cc96f04348dedfd",
        parent_uid:    "8d3bdda7363b3a4b18d9d5b7c4083899",
        file_type:     "application/pdf",
        file_location:
          "https://open-learning-course-data-production.s3.amazonaws.com/8-02-physics-ii-electricity-and-magnetism-spring-2007/d7d1fabcb57a6d4a9cc96f04348dedfd_acknowledgements.pdf"
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
      assert.equal(fileName, "/pages/readings/summary_w12d2.md")
      assert.deepEqual(markdown, {
        title:       "summary_w12d2.pdf",
        description:
          "This file talks about how electricity and magnetism interact with each other and also considers finalizing Maxwell?s Equations, their result ? electromagnetic (EM) radiation and how energy flows in electric and magnetic fields.",
        layout:        "pdf",
        uid:           "a1bfc34ccf08ddf8474627b9a13d6ca8",
        parent_uid:    "0daf498714598983aa855689f242c83b",
        file_type:     "application/pdf",
        file_location:
          "https://open-learning-course-data-production.s3.amazonaws.com/8-02-physics-ii-electricity-and-magnetism-spring-2007/a1bfc34ccf08ddf8474627b9a13d6ca8_summary_w12d2.pdf"
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
            null,
            "course_section",
            "syllabus",
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

    it("calls yaml.safeDump once", () => {
      expect(safeDump).to.be.calledOnce
    })

    it("doesn't create a menu entry if list_in_left_nav is false and it's not a root section", () => {
      courseSectionFrontMatter = yaml.safeLoad(
        markdownGenerators
          .generateCourseSectionFrontMatter(
            "Syllabus",
            null,
            null,
            "course_section",
            "syllabus",
            false,
            singleCourseJsonData["short_url"]
          )
          .replace(/---\n/g, "")
      )
      expect(courseSectionFrontMatter["menu"]).to.be.undefined
    })

    it("handles missing short_page_title correctly", async () => {
      const yaml = markdownGenerators.generateCourseSectionFrontMatter(
        "Syllabus",
        null,
        null,
        "course_section",
        "syllabus",
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
