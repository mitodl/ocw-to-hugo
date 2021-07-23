const fs = require("fs")
const moment = require("moment")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const tmp = require("tmp")

const { INPUT_COURSE_DATE_FORMAT } = require("./constants")
const fileOperations = require("./file_operations")
const { generateDataTemplate } = require("./data_template_generators")
const helpers = require("./helpers")

const testDataPath = "test_data/courses"
const singleCourseId = "16-89j-space-systems-engineering-spring-2007"
const singleCourseParsedJsonPath = path.join(
  testDataPath,
  singleCourseId,
  `${singleCourseId}_parsed.json`
)
const singleCourseRawData = fs.readFileSync(singleCourseParsedJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)

const physicsCourseId = "8-01sc-classical-mechanics-fall-2016"
const physicsCourseParsedJsonPath = path.join(
  testDataPath,
  physicsCourseId,
  `${physicsCourseId}_parsed.json`
)
const physicsCourseRawData = fs.readFileSync(physicsCourseParsedJsonPath)
const physicsCourseJsonData = JSON.parse(physicsCourseRawData)

describe("generateDataTemplate", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog, courseDataTemplate, pathLookup, physicsCourseDataTemplate

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [
        singleCourseId,
        physicsCourseId,
        "8-01x-physics-i-classical-mechanics-with-an-experimental-focus-fall-2002",
        "17-40-american-foreign-policy-past-present-and-future-fall-2017",
        "17-40-american-foreign-policy-past-present-future-fall-2010",
        "17-40-american-foreign-policy-past-present-and-future-fall-2004",
        "17-40-american-foreign-policy-past-present-and-future-fall-2002"
      ]
    )
    courseDataTemplate = generateDataTemplate(singleCourseJsonData, pathLookup)
    physicsCourseDataTemplate = generateDataTemplate(
      physicsCourseJsonData,
      pathLookup
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("sets the course_id property to the short_url property of the course json data", () => {
    const expectedValue = singleCourseJsonData["short_url"]
    const foundValue = courseDataTemplate["course_id"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_title property to the title property of the course json data", () => {
    const expectedValue = singleCourseJsonData["title"]
    const foundValue = courseDataTemplate["course_title"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_image_url property to the image_src property of the course json data", () => {
    const expectedValue = singleCourseJsonData["image_src"]
    const foundValue = courseDataTemplate["course_image_url"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_thumbnail_image_url property to the thumbnail_image_src property of the course json data", () => {
    const expectedValue = singleCourseJsonData["thumbnail_image_src"]
    const foundValue = courseDataTemplate["course_thumbnail_image_url"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the course_image_caption_text property to the image_caption_text property of the course json data", () => {
    const expectedValue = singleCourseJsonData["image_caption_text"]
    const foundValue = courseDataTemplate["course_image_caption_text"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the publishdate property to the first_published_to_production property of the course json data", () => {
    const expectedValue = moment(
      singleCourseJsonData["first_published_to_production"],
      INPUT_COURSE_DATE_FORMAT
    ).format()
    const foundValue = courseDataTemplate["publishdate"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the instructors property to the instructors found in the instuctors node of the course json data", () => {
    assert.deepEqual(courseDataTemplate["instructors"], [
      {
        first_name:     "Edward",
        last_name:      "Crawley",
        middle_initial: "",
        salutation:     "Prof.",
        instructor:     "Prof. Edward Crawley",
        url:            "/search/?q=%22Prof.%20Edward%20Crawley%22",
        uid:            "e042c8f9995fcc110a2a5aafa674c5e6"
      },
      {
        first_name:     "Olivier",
        last_name:      "de Weck",
        middle_initial: "",
        salutation:     "Prof.",
        instructor:     "Prof. Olivier de Weck",
        url:            "/search/?q=%22Prof.%20Olivier%20de%20Weck%22",
        uid:            "07d4f0555edfebf2c2477bbf2d19dd91"
      }
    ])
  })

  it("sets the department property to the department found on the url property of the course json data, title cased with hyphens replaced with spaces", () => {
    assert.deepEqual(
      [
        {
          department: "Aeronautics and Astronautics",
          url:        `/search/?d=${encodeURIComponent(
            "Aeronautics and Astronautics"
          )}`
        },
        {
          department: "Institute for Data, Systems, and Society",
          url:        `/search/?d=${encodeURIComponent(
            "Institute for Data, Systems, and Society"
          )}`
        }
      ],
      courseDataTemplate["departments"]
    )
  })

  it("sets the course_features property to the instructors found in the instuctors node of the course json data", () => {
    singleCourseJsonData["course_feature_tags"].forEach(
      (courseFeature, index) => {
        const expectedValue = helpers.getCourseFeatureObject(
          courseFeature,
          singleCourseJsonData,
          pathLookup
        )
        const foundValue = courseDataTemplate["course_features"][index]
        sinon.assert.match(expectedValue, foundValue)
      }
    )
  })

  it("sets the topics property on the course data template to a consolidated list of topics from the course_collections property of the course json data", () => {
    const expectedValue = helpers.getConsolidatedTopics(
      singleCourseJsonData["course_collections"]
    )[0]
    const foundValue = courseDataTemplate["topics"][0]
    sinon.assert.match(expectedValue, foundValue)
  })

  it("sets the primary_course_number property on the course data template to data parsed from department_number and master_course_number in the course json data", () => {
    const expectedValue = helpers.getPrimaryCourseNumber(singleCourseJsonData)
    const foundValues = courseDataTemplate["primary_course_number"]
    assert.equal(expectedValue, foundValues)
  })

  it("sets the term property on the course data template to from_semester and from_year in the course json data", () => {
    const expectedValue = `${singleCourseJsonData["from_semester"]} ${singleCourseJsonData["from_year"]}`
    const foundValue = courseDataTemplate["term"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the level property on the course data template to course_level in the course json data", () => {
    const level = singleCourseJsonData["course_level"]
    const foundValue = courseDataTemplate["level"]
    assert.deepEqual(
      {
        level: level,
        url:   "/search/?l=Graduate"
      },
      foundValue
    )
  })

  it("sets the expected text in other_versions", () => {
    const expectedValue = [
      "[8.01X PHYSICS I: CLASSICAL MECHANICS WITH AN EXPERIMENTAL FOCUS](/courses/8-01x-physics-i-classical-mechanics-with-an-experimental-focus-fall-2002) |  FALL 2002"
    ]
    const foundValue = physicsCourseDataTemplate["other_versions"]
    assert.deepEqual(expectedValue, foundValue)
  })

  it("sets the expected text in other_versions which mentions scholars", () => {
    const courseId =
      "8-01x-physics-i-classical-mechanics-with-an-experimental-focus-fall-2002"
    const jsonPath = path.join(
      testDataPath,
      courseId,
      `${courseId}_parsed.json`
    )
    const rawData = fs.readFileSync(jsonPath)
    const json = JSON.parse(rawData)
    const template = generateDataTemplate(json, pathLookup)
    const expectedValue = [
      "[8.01SC CLASSICAL MECHANICS](/courses/8-01sc-classical-mechanics-fall-2016) | SCHOLAR,  FALL 2016"
    ]
    const foundValue = template["other_versions"]
    assert.deepEqual(expectedValue, foundValue)
  })

  it("sets archived versions with dspace urls", () => {
    const courseId =
      "17-40-american-foreign-policy-past-present-and-future-fall-2017"
    const jsonPath = path.join(
      testDataPath,
      courseId,
      `${courseId}_parsed.json`
    )
    const rawData = fs.readFileSync(jsonPath)
    const json = JSON.parse(rawData)
    const template = generateDataTemplate(json, pathLookup)
    const expectedValue = [
      "[17.40 AMERICAN FOREIGN POLICY: PAST, PRESENT, FUTURE](https://dspace.mit.edu/handle/1721.1/116542) |  FALL 2010",
      "[17.40 AMERICAN FOREIGN POLICY: PAST, PRESENT, AND FUTURE](https://dspace.mit.edu/handle/1721.1/71203) |  FALL 2004",
      "[17.40 AMERICAN FOREIGN POLICY: PAST, PRESENT, AND FUTURE](https://dspace.mit.edu/handle/1721.1/35797) |  FALL 2002"
    ]
    const foundValue = template["archived_versions"]
    assert.deepEqual(expectedValue, foundValue)
  })

  it("sets the expected text in open_learning_library_versions", () => {
    const expectedValue = [
      "[8.01.1x Mechanics-Kinematics and Dynamics](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+8.01.1x+3T2018/about) | OPEN LEARNING LIBRARY",
      "[8.01.2x Mechanics-Momentum and Energy](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+8.01.2x+3T2018/about) | OPEN LEARNING LIBRARY",
      "[8.01.3x Mechanics-Rotational Dynamics](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+8.01.3x+1T2019/about) | OPEN LEARNING LIBRARY",
      "[8.01.4x Mechanics-Simple Harmonic Motion](https://openlearninglibrary.mit.edu/courses/course-v1:MITx+8.01.4x+1T2019/about) | OPEN LEARNING LIBRARY"
    ]
    const foundValue =
      physicsCourseDataTemplate["open_learning_library_versions"]
    assert.deepEqual(expectedValue, foundValue)
  })
})
