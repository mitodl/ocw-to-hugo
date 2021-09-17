const path = require("path")
const { assert, expect } = require("chai")
const fs = require("fs")
const tmp = require("tmp")
const sinon = require("sinon")
tmp.setGracefulCleanup()

const helpers = require("./helpers")
const loggers = require("./loggers")
const fileOperations = require("./file_operations")
const {
  readCourseJson,
  singleCourseId,
  unpublishedCourseId,
  externalNavCourseId,
  imageGalleryCourseId,
  engineering1601Id,
  algorithmsCourseId,
  subtitlesCourseId,
  videoGalleryCourseId
} = require("./test_utils")

describe("helper functions", () => {
  let singleCourseJsonData, unpublishedCourseJsonData, externalNavCourseJsonData

  beforeEach(() => {
    singleCourseJsonData = readCourseJson(singleCourseId)
    unpublishedCourseJsonData = readCourseJson(unpublishedCourseId)
    externalNavCourseJsonData = readCourseJson(externalNavCourseId)
  })

  describe("findDepartmentByNumber", () => {
    it("returns the expected department for a given department number integer", () => {
      assert.equal(helpers.findDepartmentByNumber(18)["title"], "Mathematics")
    })

    it("returns the expected department for a given department number string", () => {
      assert.equal(helpers.findDepartmentByNumber("18")["title"], "Mathematics")
    })
  })

  describe("getDepartments", () => {
    it("returns the expected departments for a given course json input", () => {
      assert.deepEqual(helpers.getDepartments(singleCourseJsonData), [
        {
          department: "Mechanical Engineering",
          url:        `/search/?d=${encodeURIComponent("Mechanical Engineering")}`
        },
        {
          department: "Aeronautics and Astronautics",
          url:        `/search/?d=${encodeURIComponent(
            "Aeronautics and Astronautics"
          )}`
        }
      ])
    })
  })

  describe("getRootSections", () => {
    it("returns the expected root course sections for a given course json input", () => {
      const rootSections = helpers
        .getRootSections(singleCourseJsonData)
        .map(rootSection => rootSection["short_url"])
      const expectedRootSections = [
        "syllabus",
        "calendar",
        "study-materials",
        "labs",
        "assignments",
        "projects",
        "related-resources"
      ]
      assert.deepEqual(rootSections, expectedRootSections)
    })
  })

  describe("getInternalMenuItems", () => {
    it("returns the expected menu items for internal course sections", async () => {
      const pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        [singleCourseId]
      )
      const menuItems = helpers.getInternalMenuItems(
        singleCourseJsonData,
        pathLookup
      )
      const expectedMenuItems = [
        {
          identifier: "14896ec808d2b8ea4b434109ba3fb682",
          name:       "Syllabus",
          url:        "/pages/syllabus",
          weight:     10
        },
        {
          identifier: "94beff3d30e5e7bc06fd9421fe63803d",
          name:       "Calendar",
          url:        "/pages/calendar",
          weight:     20
        },
        {
          identifier: "303c499be5d236b1cde0bb36d615f4e7",
          name:       "Study Materials",
          url:        "/pages/study-materials",
          weight:     30
        },
        {
          identifier: "877f0e43412db8b16e5b2864cf8bf1cc",
          name:       "Labs",
          url:        "/pages/labs",
          weight:     40
        },
        {
          identifier: "1016059a65d256e4e12de4f25591a1b8",
          name:       "Assignments",
          url:        "/pages/assignments",
          weight:     50
        },
        {
          identifier: "293500564c0073c5971dfc2bbf334afc",
          name:       "Projects",
          url:        "/pages/projects",
          weight:     60
        },
        {
          identifier: "9759c68f7ab55cc86388d95ca05794f4",
          name:       "Related Resources",
          url:        "/pages/related-resources",
          weight:     70
        }
      ]
      assert.deepEqual(menuItems, expectedMenuItems)
    })
  })

  describe("getExternalMenuItems", () => {
    it("returns the expected external nav items for a given course json input", () => {
      const externalMenuItems = helpers.getExternalMenuItems(
        externalNavCourseJsonData
      )
      const expectedMenuItems = [
        {
          course_id: "7-00-covid-19-sars-cov-2-and-the-pandemic-fall-2020",
          title:     "Online Publication",
          url:
            "https://biology.mit.edu/undergraduate/current-students/subject-offerings/covid-19-sars-cov-2-and-the-pandemic/"
        }
      ]
      assert.deepEqual(externalMenuItems, expectedMenuItems)
    })
  })

  describe("getPrimaryCourseNumber", () => {
    it("returns the expected primary course number for a given course json input", () => {
      assert.equal(
        helpers.getPrimaryCourseNumber(singleCourseJsonData),
        "2.00AJ"
      )
    })
  })

  describe("getExtraCourseNumbers", () => {
    it("returns the expected extra course numbers for a given course json input", () => {
      assert.equal(
        helpers.getExtraCourseNumbers(singleCourseJsonData)[0],
        "16.00AJ"
      )
    })
  })

  describe("getCourseFeatureObject", async () => {
    const pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [singleCourseId]
    )

    it("returns the expected object from a course feature object", async () => {
      const featureObject = helpers.getCourseFeatureObject(
        singleCourseJsonData["course_feature_tags"][2],
        singleCourseJsonData,
        pathLookup
      )
      assert.equal(featureObject["feature"], "Assignments")
      assert.equal(featureObject["subfeature"], "design with examples")
    })

    it("subfeature is undefined on the course feature object if it's blank in the input data", () => {
      const featureObject = helpers.getCourseFeatureObject(
        singleCourseJsonData["course_feature_tags"][0],
        singleCourseJsonData,
        pathLookup
      )
      assert.equal(featureObject["feature"], "Image Gallery")
      assert.equal(featureObject["subfeature"], undefined)
    })
  })

  describe("getYoutubeEmbedHtml", () => {
    it("returned html strings contain the youtube media url for each embedded media", () => {
      let html = ""
      Object.values(singleCourseJsonData["course_embedded_media"]).forEach(
        courseEmbeddedMedia => {
          html = `${html}${helpers.getYoutubeEmbedHtml(courseEmbeddedMedia)}`
        }
      )
      Object.values(singleCourseJsonData["course_embedded_media"]).forEach(
        courseEmbeddedMedia => {
          const youTubeMedia = courseEmbeddedMedia.filter(embeddedMedia => {
            return embeddedMedia["id"] === "Video-YouTube-Stream"
          })
          youTubeMedia.forEach(embeddedMedia => {
            assert(html.includes(embeddedMedia["media_info"]))
          })
        }
      )
    })
  })

  describe("resolveUidMatches", () => {
    const courseData = readCourseJson(imageGalleryCourseId)
    const fieldTripPage = courseData["course_pages"].find(
      page => page["uid"] === "de36fe69cf33ddf238bc3896d0ce9eff"
    )

    it("replaces all resolveuid links on a given page", () => {
      assert.isTrue(fieldTripPage["text"].indexOf("resolveuid") !== -1)
      const uid1 = "97f28b51c2d76bbffa1213260d56c281",
        uid2 = "f828208d0d04e1f39c1bb31d6fbe5f2d",
        uid3 = "ef6931d2c8e6bc0b8e9a5572a78fe125",
        parentUid = "de36fe69cf33ddf238bc3896d0ce9eff"
      const courseId = courseData["short_url"]
      assert.deepEqual(
        helpers.resolveUidMatches(
          fieldTripPage["text"],
          courseData,
          {
            byUid: {
              [uid1]:      { course: courseId, path: "/path/1/" },
              [uid2]:      { course: courseId, path: "/path/2/" },
              [uid3]:      { course: courseId, path: "/path/3/" },
              [parentUid]: { course: courseId, path: "/path/parent" }
            }
          },
          true,
          false
        ),
        [
          {
            match:       [`./resolveuid/${uid1}`],
            replacement: "BASEURL_PLACEHOLDER/path/1/"
          },
          {
            match:       [`./resolveuid/${uid2}`],
            replacement: "BASEURL_PLACEHOLDER/path/2/"
          },
          {
            match:       [`./resolveuid/${uid3}`],
            replacement: "BASEURL_PLACEHOLDER/path/3/"
          }
        ]
      )
    })

    it("resolves a uid for a page", async () => {
      assert.include(fieldTripPage["text"], "resolveuid")
      const link = "./resolveuid/ef6931d2c8e6bc0b8e9a5572a78fe125"
      assert.include(
        fieldTripPage["text"],
        `<a href="${link}">planning a good field trip</a>`
      )
      const courseId = courseData["short_url"]
      const result = helpers.resolveUidMatches(
        fieldTripPage["text"],
        courseData,
        {
          byUid: {
            ef6931d2c8e6bc0b8e9a5572a78fe125: {
              course: courseId,
              path:   "/pages/instructor-insights/planning-a-good-field-trip"
            },
            de36fe69cf33ddf238bc3896d0ce9eff: {
              course: courseId,
              path:   "/path/to/parent"
            }
          }
        },
        true,
        false
      )
      const pageResult = result.find(item => item.match[0] === link)
      assert.deepEqual(pageResult, {
        replacement:
          "BASEURL_PLACEHOLDER/pages/instructor-insights/planning-a-good-field-trip",
        match: [link]
      })
    })

    //
    ;[
      [
        false,
        false,
        "/courses/12-001-introduction-to-geology-fall-2013/resources/mit12_001f14_field_trip"
      ],
      [false, true, "resources/mit12_001f14_field_trip"],
      [true, false, "BASEURL_PLACEHOLDER/resources/mit12_001f14_field_trip"],
      [true, true, "BASEURL_PLACEHOLDER/resources/mit12_001f14_field_trip"]
    ].forEach(([useShortcodes, isRelativeToRoot, expected]) => {
      it(`resolves a uid for a PDF file when useShortcodes=${String(
        useShortcodes
      )} and isRelativeToRoot=${String(isRelativeToRoot)}`, async () => {
        const link = "./resolveuid/f828208d0d04e1f39c1bb31d6fbe5f2d"
        assert.include(
          fieldTripPage["text"],
          `<a href="${link}">Field Trip Guide (PDF - 4.2MB)</a>`
        )
        const result = helpers.resolveUidMatches(
          fieldTripPage["text"],
          courseData,
          await fileOperations.buildPathsForAllCourses("test_data/courses", [
            imageGalleryCourseId
          ]),
          useShortcodes,
          isRelativeToRoot
        )
        const fileResult = result.find(item => item.match[0] === link)
        assert.deepEqual(fileResult, {
          replacement: expected,
          match:       [link]
        })
      })
    })

    it("resolves a uid for a non-pdf file", async () => {
      const link = "./resolveuid/915b6ae8ee3ce0531360df600464d389"
      const text = `<a href='${link}'>link</a>`
      const result = helpers.resolveUidMatches(
        text,
        courseData,
        await fileOperations.buildPathsForAllCourses("test_data/courses", [
          imageGalleryCourseId
        ]),
        true,
        false
      )
      const fileResult = result.find(item => item.match[0] === link)
      assert.deepEqual(fileResult, {
        replacement: "BASEURL_PLACEHOLDER/resources/img_20141011_092912",
        match:       [link]
      })
    })

    //
    ;[true, false].forEach(external => {
      it(`resolves uids for an ${
        external ? "external" : "internal"
      } course link`, () => {
        const linkingCourse = algorithmsCourseId
        const linkingCourseData = readCourseJson(algorithmsCourseId)
        const syllabusPage = linkingCourseData["course_pages"].find(
          page => page["uid"] === "7b7843dfbb2f3b5946b25de9abdf10f8"
        )
        const uid = "bb55dad7f4888f0a1ad004600c5fb1f1"
        const originalLink = `<a href="./resolveuid/${uid}"><em>1.001 Introduction to Computers and Engineering Problem Solving</em></a>`
        assert.include(syllabusPage["text"], originalLink)
        const outsideCourse = "a-nother-course-id"
        const course = external ? outsideCourse : linkingCourse
        const result = helpers.resolveUidMatches(
          originalLink,
          linkingCourseData,
          {
            byUid: {
              [uid]: { course: course, path: "/" }
            }
          },
          true,
          false
        )
        assert.deepEqual(result, [
          external
            ? {
              match:       [`./resolveuid/${uid}`],
              replacement: `/courses/${course}/`
            }
            : {
              match:       [`./resolveuid/${uid}`],
              replacement: `BASEURL_PLACEHOLDER/`
            }
        ])
      })
    })

    it(`resolves uids which don't match anything`, () => {
      const linkingCourseData = readCourseJson(algorithmsCourseId)
      const syllabusPage = linkingCourseData["course_pages"].find(
        page => page["uid"] === "7b7843dfbb2f3b5946b25de9abdf10f8"
      )
      const originalLink = `<a href="./resolveuid/bb55dad7f4888f0a1ad004600abcdef"><em>1.001 Introduction to Computers and Engineering Problem Solving</em></a>`
      const result = helpers.resolveUidMatches(
        originalLink,
        linkingCourseData,
        {},
        true,
        false
      )
      assert.deepEqual(result, [])
    })
  })

  describe("resolveRelativeLinkMatches", () => {
    let sandbox, pathLookup

    beforeEach(async () => {
      sandbox = sinon.createSandbox()
      pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        [singleCourseId, imageGalleryCourseId, engineering1601Id]
      )
    })

    afterEach(() => {
      sandbox.restore()
    })

    it("fixes all relative links on the page", () => {
      const assignmentsPage = singleCourseJsonData["course_pages"].find(
        page => page["uid"] === "1016059a65d256e4e12de4f25591a1b8"
      )
      const result = helpers.resolveRelativeLinkMatches(
        assignmentsPage["text"],
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.lengthOf(result, 1)
      assert.equal(
        result[0].match[0],
        `href="/courses/mechanical-engineering/2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009/projects"`
      )
      assert.equal(result[0].match.index, 121)
      assert.equal(
        result[0].replacement,
        'href="BASEURL_PLACEHOLDER/pages/projects"'
      )
    })

    it("resolves a link for a PDF in the same course", () => {
      const text = `2010. (<a href="/courses/some-text-here/${singleCourseId}/study-materials/MIT2_00AJs09_lec02.pdf">PDF</a>`

      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.equal(
        result[0].replacement,
        'href="BASEURL_PLACEHOLDER/resources/mit2_00ajs09_lec02"'
      )
    })

    it("resolves a link for a PDF in another course", () => {
      const text =
        '2010. (<a href="/courses/some-text-here/12-001-introduction-to-geology-fall-2013/field-trip/MIT12_001F14_Field_Trip.pdf">PDF</a>'

      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.equal(
        result[0].replacement,
        'href="/courses/12-001-introduction-to-geology-fall-2013/resources/mit12_001f14_field_trip"'
      )
    })

    it("doesn't resolve a link for a PDF in another course if that course is missing", () => {
      const link =
        "/courses/civil-and-environmental-engineering/1-011-project-evaluation-spring-2011/readings/mit1_011s11_read16a.pdf"
      const text = `2010. (<a href="${link}">PDF</a>`

      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.lengthOf(result, 1)
      assert.deepEqual(result[0].match[0], `href="${link}"`)
    })

    it("handles a missing media file location", () => {
      sandbox.stub(loggers.memoryTransport, "log").callsFake((...args) => {
        throw new Error(`Error caught: ${args}`)
      })
      const assignmentsPage = singleCourseJsonData["course_pages"].find(
        page => page["uid"] === "1016059a65d256e4e12de4f25591a1b8"
      )
      const text = `${assignmentsPage["text"]} <a href="/courses/mathematics/18-01-single-variable-calculus-fall-2006/exams/prfinalsol.pdf" />`
      delete singleCourseJsonData.course_files[0].file_location
      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.lengthOf(result, 2)
      assert.equal(
        result[0].match[0],
        `href="/courses/mechanical-engineering/2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009/projects"`
      )
      assert.equal(result[0].match.index, 121)
      assert.equal(
        result[0].replacement,
        'href="BASEURL_PLACEHOLDER/pages/projects"'
      )
      const link =
        "/courses/mathematics/18-01-single-variable-calculus-fall-2006/exams/prfinalsol.pdf"
      assert.equal(result[1].match[0], `href="${link}"`)
      assert.equal(result[1].match.index, 5623)
      assert.equal(result[1].replacement, `href="${link}"`)
    })

    it("resolves relative links while keeping hashes", () => {
      const text =
        '<a href="/courses/aeronautics-and-astronautics/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/syllabus#Table_organization">Table Organization</a></p> '
      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup
      )
      assert.equal(
        result[0].replacement,
        'href="/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/syllabus#Table_organization"'
      )
    })

    //
    ;[true, false].forEach(external => {
      it(`resolves relative links for ${
        external ? "external courses" : "the same course"
      }`, () => {
        const otherCourseId =
          "16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006"
        const courseId = external ? otherCourseId : singleCourseId
        const text = `<a href="/courses/aeronautics-and-astronautics/${courseId}/syllabus#Table_organization">Table Organization</a></p> `
        const result = helpers.resolveRelativeLinkMatches(
          text,
          singleCourseJsonData,
          pathLookup,
          true,
          false
        )
        assert.equal(
          result[0].replacement,
          external
            ? `href="/courses/${otherCourseId}/pages/syllabus#Table_organization"`
            : 'href="BASEURL_PLACEHOLDER/pages/syllabus#Table_organization"'
        )
      })
    })

    //
    ;["index.htm", "index.html"].forEach(page => {
      it(`treats links ending with ${page} like a course link`, () => {
        const text = `<a href="/courses/aeronautics-and-astronautics/${singleCourseId}/${page}#Table_organization">Table Organization</a></p> `
        const result = helpers.resolveRelativeLinkMatches(
          text,
          singleCourseJsonData,
          pathLookup,
          true,
          false
        )
        assert.equal(
          result[0].replacement,
          'href="BASEURL_PLACEHOLDER/#Table_organization"'
        )
      })
    })

    it("handles links with multiple sections appropriately", () => {
      const text = `<a href="/courses/aeronautics-and-astronautics/${singleCourseId}/a/b/c/d/e#Table_organization">Table Organization</a></p> `
      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.equal(
        result[0].replacement,
        'href="BASEURL_PLACEHOLDER/pages/a/b/c/d/e#Table_organization"'
      )
    })

    it("handles non-course relative links by leaving them as is", () => {
      const link = "/a/e/e#Table_organization"
      const text = `<a href="${link}">Table Organization</a></p> `
      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.lengthOf(result, 1)
      assert.equal(result[0].replacement, `href="${link}"`)
    })

    it("handles relative links to static assets by adding an S3 link", () => {
      const text = `<a href="/courses/aeronautics-and-astronautics/${singleCourseId}/labs/12.jpg">Table Organization</a></p> `
      const result = helpers.resolveRelativeLinkMatches(
        text,
        singleCourseJsonData,
        pathLookup,
        true,
        false
      )
      assert.equal(
        result[0].replacement,
        'href="BASEURL_PLACEHOLDER/resources/12"'
      )
    })

    it("picks the correct PDF link", () => {
      const courseData = readCourseJson(engineering1601Id)

      const text = `<a href="/courses/aeronautics-and-astronautics/${engineering1601Id}/comps-programming/m19.pdf">`
      const result = helpers.resolveRelativeLinkMatches(
        text,
        courseData,
        pathLookup,
        true,
        false
      )
      assert.equal(
        result[0].replacement,
        'href="BASEURL_PLACEHOLDER/resources/m19"'
      )
    })

    //
    ;[
      [
        false,
        false,
        "/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/resources/objectives-1"
      ],
      [false, true, "resources/objectives-1"],
      [true, false, "BASEURL_PLACEHOLDER/resources/objectives-1"],
      [true, true, "BASEURL_PLACEHOLDER/resources/objectives-1"]
    ].forEach(([useShortcodes, isRelativeToRoot, expected]) => {
      it(`picks the correct PDF when there are two items with the same filename but with different parents, when useShortcodes=${String(
        useShortcodes
      )} and isRelativeToRoot=${String(isRelativeToRoot)}`, () => {
        const courseData = readCourseJson(engineering1601Id)

        const text = `<a href="/courses/aeronautics-and-astronautics/${engineering1601Id}/signals-systems/objectives.pdf">PDF</a>`
        const result = helpers.resolveRelativeLinkMatches(
          text,
          courseData,
          pathLookup,
          useShortcodes,
          isRelativeToRoot
        )
        assert.equal(result[0].replacement, `href="${expected}"`)
      })
    })

    //
    ;["http://ocw.mit.edu", "https://ocw.mit.edu"].forEach(prefix => {
      it(`strips ${prefix} and handles the URL like a relative URL`, () => {
        const text = `<a href="${prefix}/courses/aeronautics-and-astronautics/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/syllabus#Table_organization">Table Organization</a></p> `
        const result = helpers.resolveRelativeLinkMatches(
          text,
          singleCourseJsonData,
          pathLookup
        )
        assert.equal(
          result[0].replacement,
          'href="/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/syllabus#Table_organization"'
        )
      })
    })
  })

  describe("resolveYouTubeEmbedMatches", () => {
    let sandbox

    beforeEach(() => {
      sandbox = sinon.createSandbox()
    })

    afterEach(() => {
      sandbox.restore()
    })

    it("resolves youtube embed links", async () => {
      const youtubeKey =
        "99525203lab5:savoniuswindturbineconstructionandtesting48221462"
      const htmlStr = `some text ${youtubeKey} other text`
      const courseData = readCourseJson(videoGalleryCourseId)
      const pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        [videoGalleryCourseId]
      )
      const results = helpers.resolveYouTubeEmbedMatches(
        htmlStr,
        courseData,
        pathLookup
      )
      const match = [youtubeKey]
      match.index = 10
      assert.deepEqual(results, [
        {
          replacement: '<div class="youtube-placeholder">LnSvSfXUmVs;</div>',
          match
        }
      ])
      // verify that if there is a key not present in the html, it is skipped
      assert.lengthOf(Object.values(courseData["course_embedded_media"]), 21)
    })

    //
    ;[
      [
        false,
        false,
        "/courses/21g-107-chinese-i-streamlined-fall-2014/resources/instructor-interview-course-iteration"
      ],
      [false, true, "resources/instructor-interview-course-iteration"],
      [
        true,
        false,
        "BASEURL_PLACEHOLDER/resources/instructor-interview-course-iteration"
      ],
      [
        true,
        true,
        "BASEURL_PLACEHOLDER/resources/instructor-interview-course-iteration"
      ]
    ].forEach(([useShortcodes, isRelativeToRoot, expected]) => {
      it(`resolves youtube popup links when useShortcodes=${String(
        useShortcodes
      )} and isRelativeToRoot=${String(isRelativeToRoot)}`, async () => {
        const youtubeKey = "16382356instructorinterview:courseiteration55791478"
        const htmlStr = `some text ${youtubeKey} other text`
        const courseData = readCourseJson(subtitlesCourseId)
        const pathLookup = await fileOperations.buildPathsForAllCourses(
          "test_data/courses",
          [subtitlesCourseId]
        )
        const results = helpers.resolveYouTubeEmbedMatches(
          htmlStr,
          courseData,
          pathLookup,
          useShortcodes,
          isRelativeToRoot
        )
        const match = [youtubeKey]
        match.index = 10
        assert.deepEqual(results, [
          {
            replacement: `<a href = "${expected}">Instructor Interview: Incorporating Authentic Text Going Forward</a>`,
            match
          }
        ])
        // verify that if there is a key not present in the html, it is skipped
        assert.lengthOf(Object.values(courseData["course_embedded_media"]), 11)
      })
    })
  })

  describe("stripS3", () => {
    beforeEach(() => {
      helpers.runOptions.strips3 = true
    })

    afterEach(() => {
      helpers.runOptions.strips3 = undefined
    })

    it("strips OCW base S3 URL from a URL string", () => {
      const input =
        "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
      assert.equal(helpers.stripS3(input), "/test.jpg")
    })

    it("strips regardless of protocol", () => {
      const input = "http://open-learning-course-data.s3.amazonaws.com/test.jpg"
      assert.equal(helpers.stripS3(input), "/test.jpg")
    })

    it("does not strip from a non OCW url", () => {
      const input = "https://something-else.amazonaws.com/test.jpg"
      assert.equal(
        helpers.stripS3(input),
        "https://something-else.amazonaws.com/test.jpg"
      )
    })

    it("does not strip if the option is turned off", () => {
      helpers.runOptions.strips3 = undefined
      const input =
        "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
      assert.equal(
        helpers.stripS3(input),
        "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
      )
    })

    it("replaces the s3 prefix with a static prefix if set", () => {
      helpers.runOptions.staticPrefix = "/courses"
      const input =
        "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
      assert.equal(helpers.stripS3(input), "/courses/test.jpg")
    })
  })

  describe("isCoursePublished", () => {
    it("returns true for an published course", () => {
      assert.isTrue(helpers.isCoursePublished(singleCourseJsonData))
    })

    it("returns false for an unpublished course", () => {
      assert.isFalse(helpers.isCoursePublished(unpublishedCourseJsonData))
    })

    it("returns the expected value for a set of comparisons", () => {
      [
        [null, null, false],
        ["", null, false],
        ["2010/03/10 0:0:0.000", null, true],
        ["2010/03/10 0:0:0.000", "", true],
        [null, "2010/03/10 0:0:0.000", false],
        ["2010/03/10 0:0:0.000", "2010/03/11 0:0:0.000", false],
        ["2010/03/11 0:0:0.000", "2010/03/10 0:0:0.000", true]
      ].forEach(([pubDate, unpubDate, published]) => {
        const courseData = {
          last_unpublishing_date:       unpubDate,
          last_published_to_production: pubDate
        }
        assert.equal(helpers.isCoursePublished(courseData), published)
      })
    })
  })

  describe("buildPathsForCourse", () => {
    it("builds some paths", () => {
      const uidLookup = fileOperations.makeUidInfoLookup(singleCourseJsonData)
      const paths = helpers.buildPathsForCourse(singleCourseJsonData, uidLookup)
      assert.deepEqual(paths["303c499be5d236b1cde0bb36d615f4e7"], {
        path:          "/pages/study-materials",
        unalteredPath: "/pages/study-materials"
      })
      assert.deepEqual(paths["42664d52bd9a5b1632bac20876dc344d"], {
        path:          "/pages/index.htm",
        unalteredPath: "/pages/index.htm"
      })
      assert.deepEqual(paths["b6a31a6a85998d664ea826a766d9032b"], {
        path:          "/resources/2-00ajs09",
        unalteredPath: "/pages/2-00ajs09.jpg"
      })
      assert.deepEqual(paths["6f5063fc562d919e4005ac2c983eefb7"], {
        path:          "/resources/mit2_00ajs09_res01b",
        unalteredPath: "/pages/study-materials/MIT2_00AJs09_res01B.pdf"
      })
      assert.lengthOf(Object.values(paths), 67)
    })
  })

  describe("misc functions", () => {
    it("strips a suffix", () => {
      const stripPdfSuffix = helpers.stripSuffix(".pdf")
      assert.equal(stripPdfSuffix("some text"), "some text")
      assert.equal(stripPdfSuffix("some text.pdf"), "some text")
      assert.equal(stripPdfSuffix("some text.PDF"), "some text")
      assert.equal(stripPdfSuffix("some text.PDF.pdf"), "some text.PDF")
    })

    it("doesn't strip anything if there is no suffix", () => {
      const stripNothing = helpers.stripSuffix("")
      assert.equal(stripNothing("something"), "something")
    })

    it("strips / from the prefix", () => {
      assert.equal(helpers.stripSlashPrefix("/a/b/c/"), "a/b/c/")
      assert.equal(helpers.stripSlashPrefix("d/e/f"), "d/e/f")
    })

    it("replaces a substring", () => {
      assert.equal(
        helpers.replaceSubstring("there is some text here", 9, 4, "a lot of"),
        "there is a lot of text here"
      )
      assert.equal(
        helpers.replaceSubstring(
          "there is some text here",
          13,
          0,
          " amount of"
        ),
        "there is some amount of text here"
      )
      assert.equal(
        helpers.replaceSubstring("there is some text here", 9, 5, ""),
        "there is text here"
      )
    })

    it("replaces a list of items", () => {
      const text = "The quick brown fox jumps over the lazy dog"
      const os = Array.from(text.matchAll(/o/g))
      const replacementItems = os.map(match => ({ match, replacement: "00" }))
      const newText = helpers.applyReplacements(replacementItems, text)
      assert.equal(newText, "The quick br00wn f00x jumps 00ver the lazy d00g")
    })

    it("gets the path pieces from a url", () => {
      assert.deepEqual(helpers.getPathFragments("/a/b/c/"), ["a", "b", "c"])
      assert.deepEqual(
        helpers.getPathFragments("https://mit.edu/path/to/course#hash"),
        ["path", "to", "course"]
      )
      assert.deepEqual(helpers.getPathFragments("d/e/f"), ["d", "e", "f"])
    })

    it("updates the path of a url", () => {
      assert.deepEqual(
        helpers.updatePath("/a/b/c/", ["BASEURL_PLACEHOLDER", "d", "e", "f"]),
        "BASEURL_PLACEHOLDER/d/e/f"
      )
      assert.deepEqual(helpers.updatePath("/a/b/c/", ["d", "e", "f"]), "/d/e/f")
      assert.deepEqual(
        helpers.updatePath("https://mit.edu/path/to/course#hash", [
          "course_home"
        ]),
        "https://mit.edu/course_home#hash"
      )
      assert.deepEqual(
        helpers.updatePath("d/e/f", ["", "a", "b", "c"]),
        "/a/b/c"
      )
      assert.deepEqual(helpers.updatePath("d/e/f", ["a", "b", "c"]), "/a/b/c")
      assert.deepEqual(helpers.updatePath("f/g/h", []), "/")
    })

    //
    ;[
      ["https://dspace.mit.edu/handle/1721.1/75001", "1721.1/75001"],
      ["http://dspace.mit.edu/handle/1721.1/75001", "1721.1/75001"],
      ["https://hdl.handle.net/172.1/12345", "172.1/12345"],
      ["http://hdl.handle.net/172.1/12345", "172.1/12345"],
      ["hdl://23.45/456", "23.45/456"],
      ["www.cnn.com", null],
      ["/", null]
    ].forEach(([url, expected]) => {
      it(`parses a dspace URL like ${url}`, () => {
        assert.equal(helpers.parseDspaceUrl(url), expected)
      })
    })

    it("adds dashes to a uid imported from Plone in the proper spots", () => {
      const input = "e042c8f9995fcc110a2a5aafa674c5e6"
      const output = helpers.addDashesToUid(input)
      const expected = "e042c8f9-995f-cc11-0a2a-5aafa674c5e6"
      assert.equal(output, expected)
    })
  })
})
