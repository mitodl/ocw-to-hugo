const path = require("path")
const { assert } = require("chai")
const helpers = require("./helpers")
const fs = require("fs")
const tmp = require("tmp")
tmp.setGracefulCleanup()

const singleCourseSourcePath =
"test_data/1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
const singleCourseMasterJsonPath = path.join(
  singleCourseSourcePath,
  "bb55dad7f4888f0a1ad004600c5fb1f1_master.json"
)
const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)

describe("getCourseImageUrl", () => {
  it("returns the expected course image file name for a given course json input", () => {
    assert.equal(
      helpers.getCourseImageUrl(singleCourseJsonData),
      "https://open-learning-course-data.s3.amazonaws.com/1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012/457598d84426c61f83ab06ad2aa39c04_1-00s12.jpg"
    )
  })
})

describe("getCourseNumber", () => {
  it("returns the expected course number for a given course json input", () => {
    assert.equal(
      helpers.getCourseNumber(singleCourseJsonData),
      "1.00"
    )
  })
})

describe("getCourseSectionFromFeatureUrl", () => {
  it("returns the expected course section from a course feature object", () => {
    assert.equal(
      helpers.getCourseSectionFromFeatureUrl(singleCourseJsonData["course_features"][2]),
      "instructor-insights"
    )
  })
})

describe("getCourseCollectionText", () => {
  it("returns the expected course collection from a course collection object", () => {
    assert.equal(
      helpers.getCourseCollectionText(singleCourseJsonData["course_collections"][0]),
      "Engineering > Systems Engineering"
    )
  })
})

describe("makeTopic", () => {
  it("returns the expected topic from a course collection object", () => {
    assert.equal(
      helpers.makeTopic(singleCourseJsonData["course_collections"][0]),
      "Engineering - Systems Engineering"
    )
  })
})
