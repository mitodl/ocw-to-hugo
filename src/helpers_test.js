const path = require("path")
const { assert } = require("chai")
const fs = require("fs")
const tmp = require("tmp")
tmp.setGracefulCleanup()

const helpers = require("./helpers")
const { GETPAGESHORTCODESTART } = require("./constants")

const singleCourseInputPath =
  "test_data/courses/2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const singleCourseMasterJsonPath = path.join(
  singleCourseInputPath,
  "e395587c58555f1fe564e8afd75899e6_master.json"
)
const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)

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
  it("replaces all resolveuid links on a given page", () => {
    const assignmentsPage = singleCourseJsonData["course_pages"].filter(
      page => page["uid"] === "1016059a65d256e4e12de4f25591a1b8"
    )[0]
    assert.isTrue(assignmentsPage["text"].indexOf("resolveuid") !== -1)
    const result = helpers.resolveUids(
      assignmentsPage["text"],
      assignmentsPage,
      singleCourseJsonData
    )
    assert.isTrue(result.indexOf("resolveuid") === -1)
  })
})

describe("resolveRelativeLinks", () => {
  it("replaces all relative links on the page with hugo getpage shortcodes", () => {
    const assignmentsPage = singleCourseJsonData["course_pages"].filter(
      page => page["uid"] === "1016059a65d256e4e12de4f25591a1b8"
    )[0]
    assert.isTrue(assignmentsPage["text"].indexOf("{{% getpage ") === -1)
    const result = helpers.resolveRelativeLinks(
      assignmentsPage["text"],
      singleCourseJsonData,
      true
    )
    assert.isTrue(result.indexOf(GETPAGESHORTCODESTART) !== -1)
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
    assert.equal(
      helpers.stripS3(input),
      "/courses/test.jpg"
    )
  })
})
