const path = require("path")
const expect = require("expect.js")
const helpers = require("./helpers")
const fs = require("fs")
const sinon = require("sinon")
const tmp = require("tmp")
tmp.setGracefulCleanup()

describe("getCourseImageUrl", () => {
  let readdir, consoleLog
  const sourcePath =
    "test_data/1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
  const masterJsonPath = path.join(
    sourcePath,
    "bb55dad7f4888f0a1ad004600c5fb1f1_master.json"
  )
  beforeEach(() => {
    readdir = sinon.stub(fs, "readdir")
    consoleLog = sinon.spy(console, "log")
  })

  afterEach(() => {
    readdir.restore()
    consoleLog.restore()
  })

  it("returns the expected course image file name for a given course json input", () => {
    const returnedUrl = helpers.getCourseImageUrl(
      JSON.parse(fs.readFileSync(masterJsonPath))
    )
    expect(returnedUrl).to.be.equal(
      "https://open-learning-course-data.s3.amazonaws.com/1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012/457598d84426c61f83ab06ad2aa39c04_1-00s12.jpg"
    )
  })
})
