const path = require("path")
const fs = require("fs")

const testDataPath = "test_data/courses"

const course100Id =
  "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
const singleCourseId =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const imageGalleryCourseId = "12-001-introduction-to-geology-fall-2013"
const videoGalleryCourseId = "ec-711-d-lab-energy-spring-2011"
const physics801xId =
  "8-01x-physics-i-classical-mechanics-with-an-experimental-focus-fall-2002"
const physics802Id = "8-02-physics-ii-electricity-and-magnetism-spring-2007"
const subtitlesCourseId = "21g-107-chinese-i-streamlined-fall-2014"
const classicalMechanicsId = "8-01sc-classical-mechanics-fall-2016"
const externalNavCourseId =
  "7-00-covid-19-sars-cov-2-and-the-pandemic-fall-2020"
const unpublishedCourseId = "18-435j-quantum-computation-fall-2018"
const foreignPolicyId =
  "17-40-american-foreign-policy-past-present-and-future-fall-2017"
const prevForeignPolicyIds = [
  "17-40-american-foreign-policy-past-present-future-fall-2010",
  "17-40-american-foreign-policy-past-present-and-future-fall-2004",
  "17-40-american-foreign-policy-past-present-and-future-fall-2002"
]
const spaceSystemsId = "16-89j-space-systems-engineering-spring-2007"
const covidCourseId = "7-00-covid-19-sars-cov-2-and-the-pandemic-fall-2020"

const allCourseIds = [
  course100Id,
  singleCourseId,
  imageGalleryCourseId,
  videoGalleryCourseId,
  physics801xId,
  physics802Id,
  subtitlesCourseId,
  classicalMechanicsId,
  externalNavCourseId,
  unpublishedCourseId,
  foreignPolicyId,
  ...prevForeignPolicyIds,
  spaceSystemsId,
  covidCourseId
]

const getParsedJsonPath = courseId =>
  path.join(testDataPath, courseId, `${courseId}_parsed.json`)
const readCourseJson = courseId =>
  JSON.parse(fs.readFileSync(getParsedJsonPath(courseId)))

module.exports = {
  testDataPath,
  readCourseJson,
  getParsedJsonPath,
  course100Id,
  singleCourseId,
  imageGalleryCourseId,
  videoGalleryCourseId,
  physics801xId,
  physics802Id,
  subtitlesCourseId,
  classicalMechanicsId,
  externalNavCourseId,
  unpublishedCourseId,
  foreignPolicyId,
  prevForeignPolicyIds,
  spaceSystemsId,
  covidCourseId,
  allCourseIds
}
