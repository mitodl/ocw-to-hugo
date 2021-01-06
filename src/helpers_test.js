const path = require("path")
const { assert } = require("chai")
const fs = require("fs")
const tmp = require("tmp")
const sinon = require("sinon")
tmp.setGracefulCleanup()

const helpers = require("./helpers")
const { GETPAGESHORTCODESTART } = require("./constants")
const loggers = require("./loggers")

const testCourse =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const singleCourseInputPath = `test_data/courses/${testCourse}`
const singleCourseMasterJsonPath = path.join(
  singleCourseInputPath,
  `${testCourse}_parsed.json`
)
const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)
const assignmentsPage = singleCourseJsonData["course_pages"].find(
  page => page["uid"] === "1016059a65d256e4e12de4f25591a1b8"
)
const unpublishedCourse = "18-435j-quantum-computation-fall-2018"
const unpublishedCourseInputPath = `test_data/courses/${unpublishedCourse}`
const unpublishedCourseMasterJsonPath = path.join(
  unpublishedCourseInputPath,
  `${unpublishedCourse}_parsed.json`
)
const unpublishedCourseRawData = fs.readFileSync(
  unpublishedCourseMasterJsonPath
)
const unpublishedCourseJsonData = JSON.parse(unpublishedCourseRawData)

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
    assert.equal(
      helpers.getDepartments(singleCourseJsonData)[0],
      "Mechanical Engineering"
    )
    assert.equal(
      helpers.getDepartments(singleCourseJsonData)[1],
      "Aeronautics and Astronautics"
    )
  })
})

describe("getCourseNumbers", () => {
  it("returns the expected course numbers for a given course json input", () => {
    assert.equal(helpers.getCourseNumbers(singleCourseJsonData)[0], "2.00AJ")
    assert.equal(helpers.getCourseNumbers(singleCourseJsonData)[1], "16.00AJ")
  })
})

describe("getCourseFeatureObject", () => {
  it("returns the expected object from a course feature object", () => {
    const featureObject = helpers.getCourseFeatureObject(
      singleCourseJsonData["course_features"][2]
    )
    assert.equal(featureObject["feature"], "Assignments")
    assert.equal(featureObject["subfeature"], "design with examples")
  })

  it("subfeature is undefined on the course feature object if it's blank in the input data", () => {
    const featureObject = helpers.getCourseFeatureObject(
      singleCourseJsonData["course_features"][0]
    )
    assert.equal(featureObject["feature"], "Image Gallery")
    assert.equal(featureObject["subfeature"], undefined)
  })
})

describe("getCourseSectionFromFeatureUrl", () => {
  it("returns the expected course section from a course feature object", () => {
    assert.equal(
      helpers.getCourseSectionFromFeatureUrl(
        singleCourseJsonData["course_features"][2]
      ),
      "./resolveuid/293500564c0073c5971dfc2bbf334afc"
    )
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

describe("pathToChildRecursive", () => {
  it("returns the expected path to a child section", () => {
    const expectedChild = singleCourseJsonData["course_pages"].filter(
      page => page["uid"] === "0aee0583c6aac4a87ddefb73319a8f26"
    )[0]
    assert.equal(
      helpers.pathToChildRecursive(
        "sections/",
        expectedChild,
        singleCourseJsonData
      ),
      "sections/labs/river-testing-photos"
    )
  })
})

describe("getHugoPathSuffix", () => {
  it("returns _index.md if the page is a parent", () => {
    const parentPage = singleCourseJsonData["course_pages"].filter(
      page => page["uid"] === "0aee0583c6aac4a87ddefb73319a8f26"
    )[0]
    assert.equal(
      helpers.getHugoPathSuffix(parentPage, singleCourseJsonData),
      "/_index.md"
    )
  })

  it("returns a blank string if the page is not a parent", () => {
    const childlessPage = singleCourseJsonData["course_pages"].filter(
      page => page["uid"] === "14896ec808d2b8ea4b434109ba3fb682"
    )[0]
    assert.equal(
      helpers.getHugoPathSuffix(childlessPage, singleCourseJsonData),
      ""
    )
  })
})

describe("resolveUids", () => {
  const course = "12-001-introduction-to-geology-fall-2013"
  const parsedPath = path.join(
    "test_data",
    "courses",
    course,
    `${course}_parsed.json`
  )
  const courseData = JSON.parse(fs.readFileSync(parsedPath))
  const fieldTripPage = courseData["course_pages"].find(
    page => page["uid"] === "de36fe69cf33ddf238bc3896d0ce9eff"
  )

  it("replaces all resolveuid links on a given page", () => {
    assert.isTrue(fieldTripPage["text"].indexOf("resolveuid") !== -1)
    const result = helpers.resolveUids(
      fieldTripPage["text"],
      fieldTripPage,
      courseData,
      {}
    )
    assert.isTrue(result.indexOf("resolveuid") === -1)
  })

  it("resolves a uid for a page", async () => {
    assert.include(fieldTripPage["text"], "resolveuid")
    assert.include(
      fieldTripPage["text"],
      '<a href="./resolveuid/ef6931d2c8e6bc0b8e9a5572a78fe125">planning a good field trip</a>'
    )
    const result = helpers.resolveUids(
      fieldTripPage["text"],
      fieldTripPage,
      courseData,
      {}
    )
    assert.include(
      result,
      '<a href="GETPAGESHORTCODESTARTcourses/12-001-introduction-to-geology-fall-2013/sections/instructor-insights/planning-a-good-field-trip/_index.mdGETPAGESHORTCODEEND">planning a good field trip</a>'
    )
  })

  it("resolves a uid for a file", () => {
    assert.include(
      fieldTripPage["text"],
      `<a href="./resolveuid/f828208d0d04e1f39c1bb31d6fbe5f2d">Field Trip Guide (PDF - 4.2MB)</a>`
    )
    const result = helpers.resolveUids(
      fieldTripPage["text"],
      fieldTripPage,
      courseData,
      {}
    )
    assert.include(
      result,
      `<a href="GETPAGESHORTCODESTARTcourses/12-001-introduction-to-geology-fall-2013/sections/field-trip/MIT12_001F14_Field_TripGETPAGESHORTCODEEND">Field Trip Guide (PDF - 4.2MB)</a>`
    )
  })
  ;[true, false].forEach(missing => {
    it(`resolves uids for a ${missing ? "missing " : ""}course`, () => {
      const linkingCourse =
        "1-204-computer-algorithms-in-systems-engineering-spring-2010"
      const linkingCourseParsedPath = path.join(
        "test_data",
        "courses",
        linkingCourse,
        `${linkingCourse}_parsed.json`
      )
      const linkingCourseData = JSON.parse(
        fs.readFileSync(linkingCourseParsedPath)
      )
      const syllabusPage = linkingCourseData["course_pages"].find(
        page => page["uid"] === "7b7843dfbb2f3b5946b25de9abdf10f8"
      )
      const otherCourseUid = "bb55dad7f4888f0a1ad004600c5fb1f1"
      const otherCourseSlug =
        "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
      const originalLink = `<a href="./resolveuid/bb55dad7f4888f0a1ad004600c5fb1f1"><em>1.001 Introduction to Computers and Engineering Problem Solving</em></a>`
      assert.include(syllabusPage["text"], originalLink)
      const lookup = {}
      if (!missing) {
        lookup[otherCourseUid] = otherCourseSlug
      }
      const result = helpers.resolveUids(
        syllabusPage["text"],
        syllabusPage,
        linkingCourseData,
        lookup
      )
      const expectedNeedle = missing
        ? `<a href="./resolveuid/${otherCourseUid}"><em>1.001 Introduction to Computers and Engineering Problem Solving</em></a>`
        : `<a href="/courses/${otherCourseSlug}"><em>1.001 Introduction to Computers and Engineering Problem Solving</em></a>`
      assert.include(result, expectedNeedle)
    })
  })
})

describe("resolveRelativeLinks", () => {
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("replaces all relative links on the page with hugo getpage shortcodes", () => {
    assert.isTrue(assignmentsPage["text"].indexOf("{{% getpage ") === -1)
    const result = helpers.resolveRelativeLinks(
      assignmentsPage["text"],
      singleCourseJsonData
    )
    assert.isTrue(result.indexOf(GETPAGESHORTCODESTART) !== -1)
  })

  it("handles a missing media file location", () => {
    sandbox.stub(loggers.memoryTransport, "log").callsFake((...args) => {
      throw new Error(`Error caught: ${args}`)
    })
    const text = `${assignmentsPage["text"]} <a href="/courses/mathematics/18-01-single-variable-calculus-fall-2006/exams/prfinalsol.pdf" />`
    delete singleCourseJsonData.course_files[0].file_location
    const result = helpers.resolveRelativeLinks(text, singleCourseJsonData)
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
    const input = "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
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
    const input = "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
    assert.equal(
      helpers.stripS3(input),
      "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
    )
  })

  it("replaces the s3 prefix with a static prefix if set", () => {
    helpers.runOptions.staticPrefix = "/courses"
    const input = "https://open-learning-course-data.s3.amazonaws.com/test.jpg"
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
