const path = require("path")
const { assert } = require("chai")
const fs = require("fs")
const tmp = require("tmp")
const sinon = require("sinon")
tmp.setGracefulCleanup()

const helpers = require("./helpers")
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

describe("resolveUidMatches", () => {
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
    const uid1 = "97f28b51c2d76bbffa1213260d56c281",
      uid2 = "f828208d0d04e1f39c1bb31d6fbe5f2d",
      uid3 = "ef6931d2c8e6bc0b8e9a5572a78fe125",
      parentUid = "de36fe69cf33ddf238bc3896d0ce9eff"
    assert.deepEqual(
      helpers.resolveUidMatches(
        fieldTripPage["text"],
        fieldTripPage,
        courseData,
        {},
        {
          [uid1]:      "/path/1/",
          [uid2]:      "/path/2/",
          [uid3]:      "/path/3/",
          [parentUid]: "/path/parent"
        }
      ),
      [
        {
          match:       [`./resolveuid/${uid1}`],
          replacement:
            "https://open-learning-course-data-production.s3.amazonaws.com/12-001-introduction-to-geology-fall-2013/97f28b51c2d76bbffa1213260d56c281_12.001_Field_TripStops2014.kml"
        },
        {
          match:       [`./resolveuid/${uid2}`],
          replacement: "BASEURL_SHORTCODE/path/parent/MIT12_001F14_Field_Trip"
        },
        {
          match:       [`./resolveuid/${uid3}`],
          replacement: "BASEURL_SHORTCODE/path/3/"
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
    const result = helpers.resolveUidMatches(
      fieldTripPage["text"],
      fieldTripPage,
      courseData,
      {},
      {
        ef6931d2c8e6bc0b8e9a5572a78fe125:
          "/sections/instructor-insights/planning-a-good-field-trip",
        de36fe69cf33ddf238bc3896d0ce9eff: "/path/to/parent"
      }
    )
    const pageResult = result.find(item => item.match[0] === link)
    assert.deepEqual(pageResult, {
      replacement:
        "BASEURL_SHORTCODE/sections/instructor-insights/planning-a-good-field-trip",
      match: [link]
    })
  })

  it("resolves a uid for a file", () => {
    const link = "./resolveuid/f828208d0d04e1f39c1bb31d6fbe5f2d"
    assert.include(
      fieldTripPage["text"],
      `<a href="${link}">Field Trip Guide (PDF - 4.2MB)</a>`
    )
    const result = helpers.resolveUidMatches(
      fieldTripPage["text"],
      fieldTripPage,
      courseData,
      {},
      {
        de36fe69cf33ddf238bc3896d0ce9eff: "/parent/node"
      }
    )
    const fileResult = result.find(item => item.match[0] === link)
    assert.deepEqual(fileResult, {
      replacement: `BASEURL_SHORTCODE/parent/node/MIT12_001F14_Field_Trip`,
      match:       [link]
    })
  })

  //
  ;[false].forEach(missing => {
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
        lookup[otherCourseUid] = { uid: otherCourseUid }
      }
      const result = helpers.resolveUidMatches(
        syllabusPage["text"],
        syllabusPage,
        linkingCourseData,
        lookup,
        {
          bb55dad7f4888f0a1ad004600c5fb1f1: "/"
        }
      )
      assert.deepEqual(
        result,
        missing
          ? []
          : [
            {
              match:       [`./resolveuid/${otherCourseUid}`],
              replacement: `BASEURL_SHORTCODE/`
            }
          ]
      )
    })
  })
})

describe("resolveRelativeLinkMatches", () => {
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("fixes all relative links on the page", () => {
    const result = helpers.resolveRelativeLinkMatches(
      assignmentsPage["text"],
      singleCourseJsonData
    )
    assert.lengthOf(result, 1)
    assert.equal(
      result[0].match[0],
      `href="/courses/mechanical-engineering/2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009/projects"`
    )
    assert.equal(result[0].match.index, 121)
    assert.equal(
      result[0].replacement,
      'href="BASEURL_SHORTCODE/sections/projects"'
    )
  })

  it("handles a missing media file location", () => {
    sandbox.stub(loggers.memoryTransport, "log").callsFake((...args) => {
      throw new Error(`Error caught: ${args}`)
    })
    const text = `${assignmentsPage["text"]} <a href="/courses/mathematics/18-01-single-variable-calculus-fall-2006/exams/prfinalsol.pdf" />`
    delete singleCourseJsonData.course_files[0].file_location
    const result = helpers.resolveRelativeLinkMatches(
      text,
      singleCourseJsonData
    )
    assert.lengthOf(result, 1)
    assert.equal(
      result[0].match[0],
      `href="/courses/mechanical-engineering/2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009/projects"`
    )
    assert.equal(result[0].match.index, 121)
    assert.equal(
      result[0].replacement,
      'href="BASEURL_SHORTCODE/sections/projects"'
    )
  })

  it("resolves relative links while keeping hashes", () => {
    const text =
      '<a href="/courses/aeronautics-and-astronautics/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/syllabus#Table_organization">Table Organization</a></p> '
    const result = helpers.resolveRelativeLinkMatches(
      text,
      singleCourseJsonData
    )
    assert.equal(
      result[0].replacement,
      'href="BASEURL_SHORTCODE/sections/syllabus#Table_organization"'
    )
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

  it("resolves youtube embed links", () => {
    const youtubeKey =
      "99525203lab5:savoniuswindturbineconstructionandtesting48221462"
    const htmlStr = `some text ${youtubeKey} other text`
    const courseId = "ec-711-d-lab-energy-spring-2011"
    const courseData = JSON.parse(
      fs.readFileSync(`test_data/courses/${courseId}/${courseId}_parsed.json`)
    )
    const results = helpers.resolveYouTubeEmbedMatches(htmlStr, courseData)
    const match = [youtubeKey]
    match.index = 10
    assert.deepEqual(results, [
      {
        replacement: "{{< youtube LnSvSfXUmVs >}}",
        match
      }
    ])
    // verify that if there is a key not present in the html, it is skipped
    assert.lengthOf(Object.values(courseData["course_embedded_media"]), 21)
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

describe("buildPaths", () => {
  it("builds some paths", () => {
    const paths = helpers.buildPaths(singleCourseJsonData)
    assert.equal(
      paths["303c499be5d236b1cde0bb36d615f4e7"],
      "/sections/study-materials"
    )
    assert.equal(
      paths["42664d52bd9a5b1632bac20876dc344d"],
      "/sections/index.htm"
    )
    assert.equal(
      paths["b6a31a6a85998d664ea826a766d9032b"],
      "/sections/2-00ajs09.jpg"
    )
    assert.equal(
      paths["6f5063fc562d919e4005ac2c983eefb7"],
      "/sections/study-materials/MIT2_00AJs09_res01B.pdf"
    )
    assert.lengthOf(Object.values(paths), 67)
  })
})

describe("misc functions", () => {
  it("strips .pdf from the url", () => {
    assert.equal(helpers.stripPdfSuffix("some text"), "some text")
    assert.equal(helpers.stripPdfSuffix("some text.pdf"), "some text")
    assert.equal(helpers.stripPdfSuffix("some text.PDF"), "some text")
    assert.equal(helpers.stripPdfSuffix("some text.PDF.pdf"), "some text.PDF")
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
      helpers.replaceSubstring("there is some text here", 13, 0, " amount of"),
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
      helpers.updatePath("/a/b/c/", ["BASEURL_SHORTCODE", "d", "e", "f"]),
      "BASEURL_SHORTCODE/d/e/f"
    )
    assert.deepEqual(helpers.updatePath("/a/b/c/", ["d", "e", "f"]), "/d/e/f")
    assert.deepEqual(
      helpers.updatePath("https://mit.edu/path/to/course#hash", [
        "course_home"
      ]),
      "https://mit.edu/course_home#hash"
    )
    assert.deepEqual(helpers.updatePath("d/e/f", ["", "a", "b", "c"]), "/a/b/c")
    assert.deepEqual(helpers.updatePath("d/e/f", ["a", "b", "c"]), "/a/b/c")
    assert.deepEqual(helpers.updatePath("f/g/h", []), "/")
  })
})
