const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const yaml = require("js-yaml")

const markdownGenerators = require("./markdown_generators")
const helpers = require("./helpers")
const fileOperations = require("./file_operations")
const {
  testDataPath,
  readCourseJson,
  singleCourseId,
  imageGalleryCourseId,
  videoGalleryCourseId,
  physics802Id,
  subtitlesCourseId,
  classicalMechanicsId,
  allCourseIds
} = require("./test_utils")

describe("markdown generators", () => {
  let singleCourseJsonData,
    imageGalleryCourseJsonData,
    videoGalleryCourseJsonData,
    physicsCourseJsonData,
    subtitlesCourseJsonData,
    classicalMechanicsJsonData,
    coursePagesWithText,
    imageGalleryPages,
    imageGalleryImages,
    videoGalleryPages,
    courseImageFeaturesFrontMatter,
    courseVideoFeaturesFrontMatter,
    pathLookup

  beforeEach(async () => {
    singleCourseJsonData = readCourseJson(singleCourseId)
    imageGalleryCourseJsonData = readCourseJson(imageGalleryCourseId)
    videoGalleryCourseJsonData = readCourseJson(videoGalleryCourseId)
    physicsCourseJsonData = readCourseJson(physics802Id)
    subtitlesCourseJsonData = readCourseJson(subtitlesCourseId)
    classicalMechanicsJsonData = readCourseJson(classicalMechanicsId)

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
      testDataPath,
      allCourseIds
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
      if (sectionMarkdownData["children"]) {
        sectionMarkdownData["children"].forEach(child => {
          assertCourseIdRecursive(child, courseId)
        })
      }
    }

    it("contains expected sections", () => {
      const markdownFileNames = videoGalleryCourseMarkdownData.map(
        markdownData => markdownData["name"]
      )
      assert.deepEqual(markdownFileNames, [
        "pages/syllabus.md",
        "pages/intro-energy-basics-human-power/_index.md",
        "pages/energy-storage/_index.md",
        "pages/lighting-biogas/_index.md",
        "pages/solar/_index.md",
        "pages/wind-micro-hydro.md",
        "pages/cooking-stoves-fuel.md",
        "pages/week-7-trip-planning-and-preparations.md",
        "pages/week-8-nicaragua-trip.md",
        "pages/projects/_index.md",
        "/resources/lab1s11.md",
        "/resources/mitec_711s11_lab1_pedal.md",
        "/resources/mitsp_775s11_pset0_rubric.md",
        "/resources/mitec_711s11_lec01_ho2.md",
        "/resources/mitec_711s11_lec01_ho1.md",
        "/resources/mitec_711s11_read_react.md",
        "/resources/mitec_711s11_lec01.md",
        "/resources/mitec_711s11_lec02.md",
        "/resources/mitec_711s11_lab3.md",
        "/resources/mitec_711s11_lec3_ho1.md",
        "/resources/mitec_711s11_lab3_pres.md",
        "/resources/mitec_711s11_lec03.md",
        "/resources/mitec_711s11_lec04.md",
        "/resources/mitec_711s11_lab5.md",
        "/resources/mitec_711s11_lec05.md",
        "/resources/mitec_711s11_read5_fuel.md",
        "/resources/mitec_711s11_read6a.md",
        "/resources/mitec_711s11_read6b.md",
        "/resources/mitec_711s11_read6c.md",
        "/resources/mitec_711s11_lec06.md",
        "/resources/mitec_711s11_lec07.md",
        "/resources/mitec_711s11_trip_tips.md",
        "/resources/mitec_711s11_trip_pack.md",
        "/resources/mitec_711s11_trip_ltr.md",
        "/resources/mitec_711s11_lec8.md",
        "/resources/mitec_711s11_proj_rptchrg.md",
        "/resources/mitec_711s11_proj_rubric.md",
        "/resources/mitec_711s11_proj_rptseal.md",
        "/resources/mitec_711s11_proj_teamass.md",
        "/resources/mitec_711s11_proj_rptfire.md",
        "/resources/mitec_711s11_proj_rpthusk.md",
        "/resources/ec-711s11.md",
        "/resources/ec-711s11-th.md",
        "/resources/lab-1-human-power.md",
        "/resources/lecture-6-cooking-stoves-fuel.md",
        "/resources/lecture-3-lighting-trip-introduction.md",
        "/resources/project-presentations-3-initial-design-review.md",
        "/resources/lab-3-biogas-and-biodigesters-part-ii-activities.md",
        "/resources/lab-6-charcoal-making-stove-testing.md",
        "/resources/lab-4-wiring-solar-panels-part-i-lecture.md",
        "/resources/project-presentations-4-final-design-review.md",
        "/resources/lecture-1-introduction-to-energy.md",
        "/resources/lab-2-solar-power-measurement-part-i-lecture.md",
        "/resources/lecture-7-solar-cookers-creative-capacity-building-trip-preparation.md",
        "/resources/project-presentations-2-trip-reports.md",
        "/resources/lecture-8-project-design-process.md",
        "/resources/lab-3-biogas-and-biodigesters-part-i-lecture.md",
        "/resources/lecture-5-wind-and-micro-hydro-power-trip-planning.md",
        "/resources/project-presentations-1-trip-planning.md",
        "/resources/lecture-4.md",
        "/resources/lab-4-wiring-solar-panels-part-ii-activities.md",
        "/resources/lab-2-solar-power-measurement-part-ii-activities.md",
        "/resources/lecture-2-energy-storage-microgrids-trip-preview.md",
        "/resources/lab-5-savonius-wind-turbine-construction-and-testing.md"
      ])
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
        const markdownData = markdownGenerators
          .generateMarkdownFromJson(subtitlesCourseJsonData, pathLookup)
          .find(file => file.name === "/resources/m_gqolc3clm-1.md")

        const embeddedMedia = yaml.safeLoad(markdownData.data.split("---\n")[1])
        assert.equal(embeddedMedia.file_location, expectedUrl)
      })
    })

    it("generates a resource page for a non-pdf file", () => {
      const markdownData = markdownGenerators.generateMarkdownFromJson(
        classicalMechanicsJsonData,
        pathLookup
      )
      const file = markdownData.find(
        file =>
          file.name ===
          "/resources/jsinput_freebodydraw_massive_rope_between_trees_setup.md"
      )
      const frontmatter = yaml.safeLoad(file.data.split("---\n")[1])
      assert.deepEqual(frontmatter, {
        description:   "",
        file_location:
          "https://open-learning-course-data-production.s3.amazonaws.com/8-01sc-classical-mechanics-fall-2016/838633c70a5b59cce23f0909eaeb96d7_jsinput_freebodydraw_massive_rope_between_trees_setup.svg",
        file_type:    "image/svg+xml",
        layout:       "resource",
        resourcetype: "Image",
        title:        "jsinput_freebodydraw_massive_rope_between_trees_setup.svg",
        uid:          "838633c70a5b59cce23f0909eaeb96d7"
      })
    })

    it("generates a resource page for a video resource", () => {
      const markdownData = markdownGenerators.generateMarkdownFromJson(
        classicalMechanicsJsonData,
        pathLookup
      )
      const file = markdownData.find(
        file => file.name === "/resources/0-1-vectors-vs.md"
      )
      const frontmatter = yaml.safeLoad(file.data.split("---\n")[1])
      assert.deepEqual(frontmatter, {
        title:          "0.1 Vectors vs. Scalars",
        description:    "",
        uid:            "5b89e3d0ea345f02540bac14b4acac9b",
        resourceType:   "Video",
        video_metadata: { youtube_id: "5ucfHd8FWKw" },
        video_files:    {
          video_captions_file:
            "/courses/physics/8-01sc-classical-mechanics-fall-2016/review-vectors/0.1-vectors-vs.-scalars/0.1-vectors-vs.-scalars/5ucfHd8FWKw.vtt"
        }
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

  describe("generateResourcePageMarkdown", () => {
    it("creates an acknowledgements.md file", () => {
      const markdownFiles = markdownGenerators.generateMarkdownFromJson(
        physicsCourseJsonData,
        pathLookup
      )
      const file = markdownFiles.find(
        file => file.name === "/resources/acknowledgements.md"
      )
      const markdown = yaml.safeLoad(file["data"].replace(/---\n/g, ""))
      assert.deepEqual(markdown, {
        title:       "acknowledgements.pdf",
        description:
          "This resource contains acknowledgements to the persons who helped build this course.",
        layout:        "resource",
        resourcetype:  "Document",
        uid:           "d7d1fabcb57a6d4a9cc96f04348dedfd",
        file_type:     "application/pdf",
        file_location:
          "https://open-learning-course-data-production.s3.amazonaws.com/8-02-physics-ii-electricity-and-magnetism-spring-2007/d7d1fabcb57a6d4a9cc96f04348dedfd_acknowledgements.pdf"
      })
    })

    it("creates a resource page for a pdf whose parent is not the course home page", () => {
      const pdfMarkdownFile = markdownGenerators
        .generateMarkdownFromJson(physicsCourseJsonData, pathLookup)
        .find(file => file.name === "/resources/summary_w12d2.md")
      const markdown = yaml.safeLoad(
        pdfMarkdownFile["data"].replace(/---\n/g, "")
      )
      assert.deepEqual(markdown, {
        title:       "summary_w12d2.pdf",
        description:
          "This file talks about how electricity and magnetism interact with each other and also considers finalizing Maxwell?s Equations, their result ? electromagnetic (EM) radiation and how energy flows in electric and magnetic fields.",
        layout:        "resource",
        uid:           "a1bfc34ccf08ddf8474627b9a13d6ca8",
        file_type:     "application/pdf",
        resourcetype:  "Document",
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
      const matches = courseVideoFeaturesFrontMatter.match(
        /{{< video-gallery-item [^>]+ >}}/g
      )
      assert.deepEqual(matches, [
        '{{< video-gallery-item href="/resources/lecture-1-introduction-to-energy" ' +
          'section="Week 1: Introduction, Energy Basics & Human Power" title="Lecture 1: Introduction to Energy" ' +
          'description="Description: This lecture introduces fundamental energy concepts: energy around in the world, energy units, ' +
          "a quick electricity review, and some estimation practice activities. The session ends with a syllabus overview. " +
          'Speaker: Amy Banzaert" thumbnail="https://img.youtube.com/vi/SbpeBF8D_m4/default.jpg" >}}',
        '{{< video-gallery-item href="/resources/lab-1-human-power" ' +
          'section="Week 1: Introduction, Energy Basics & Human Power" title="Lab 1: Human Power" ' +
          'description="Description: This lab consists of three parts: Water pumping, with a PVC hand pump and a ' +
          "cement rocker pump Water carrying, with a tump line, head carry, hand carry, and Q-drum Woodshop training " +
          'Speaker: Amy Banzaert, Amit Gandhi" thumbnail="https://img.youtube.com/vi/7MzwxhtVfFc/default.jpg" >}}'
      ])
    })
  })
})
