const fs = require("fs")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const tmp = require("tmp")
const rimraf = require("rimraf")
const git = require("simple-git")

const {
  NO_COURSES_FOUND_MESSAGE,
  MISSING_COURSE_ERROR_MESSAGE
} = require("./constants")
const helpers = require("./helpers")
const fileOperations = require("./file_operations")
const markdownGenerators = require("./markdown_generators")

const testDataPath = "test_data/courses"
const singleCourseId =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
const singleCourseMasterJsonPath = path.join(
  testDataPath,
  singleCourseId,
  "e395587c58555f1fe564e8afd75899e6_master.json"
)
const singleCourseRawData = fs.readFileSync(singleCourseMasterJsonPath)
const singleCourseJsonData = JSON.parse(singleCourseRawData)
const singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
  singleCourseJsonData
)

describe("fetchBoilerplate", () => {
  let consoleLog, git, rimRafSync
  const sandbox = sinon.createSandbox()
  const tmpDir = tmp.dirSync({ prefix: "output" }).name
  const coursesPath = path.join(tmpDir, "courses")

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
    git = sandbox.stub(helpers, "getGit").returns({
      clone: (repo, dir) => {
        if (!helpers.directoryExists(coursesPath)) {
          fs.mkdirSync(coursesPath)
        }
      }
    })
    rimRafSync = sandbox.stub(rimraf, "sync")
    await fileOperations.fetchBoilerplate(tmpDir)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("runs the function successfully and we see the mocked folder in the output folder", async () => {
    expect(fs.readdirSync(tmpDir)[0]).to.equal("courses")
  })

  it("cleans up the git tmp folder when done", async () => {
    expect(rimRafSync).to.be.calledOnce
  })
})

describe("scanCourses", () => {
  let readdirSync, lstatSync, consoleLog
  const sandbox = sinon.createSandbox()
  const inputPath = "test_data/courses"
  const outputPath = tmp.dirSync({ prefix: "output" }).name
  const logMessage = "Converting 4 courses to Hugo markdown..."
  const course1Path = path.join(
    inputPath,
    "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
  )
  const course2Path = path.join(
    inputPath,
    "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
  )
  const course3Path = path.join(
    inputPath,
    "3-00-thermodynamics-of-materials-fall-2002"
  )
  const course4Path = path.join(
    inputPath,
    "12-001-introduction-to-geology-fall-2013"
  )

  beforeEach(() => {
    readdirSync = sandbox.spy(fs, "readdirSync")
    lstatSync = sandbox.spy(fs, "lstatSync")
    consoleLog = sandbox.stub(console, "log")
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("throws an error when you call it with no input directory", () => {
    assert.throws(() => fileOperations.scanCourses(null, outputPath))
  })

  it("throws an error when you call it with no output directory", () => {
    assert.throws(() => fileOperations.scanCourses(inputPath, null))
  })

  it("displays an error when you call it with an empty courses.json", () => {
    fileOperations.scanCourses(inputPath, outputPath, {
      courses: "test_data/courses_blank.json"
    })
    expect(consoleLog).calledWithExactly(NO_COURSES_FOUND_MESSAGE)
  })

  it("displays an error when you call it with an empty input directory", () => {
    fileOperations.scanCourses("test_data/empty", outputPath)
    expect(consoleLog).calledWithExactly(NO_COURSES_FOUND_MESSAGE)
  })

  it("calls readdirSync once", () => {
    fileOperations.scanCourses(inputPath, outputPath)
    expect(readdirSync).to.be.calledOnce
  })

  it("scans the four test courses and reports to console", () => {
    fileOperations.scanCourses(inputPath, outputPath)
    expect(consoleLog).calledWithExactly(logMessage)
  })

  it("calls lstatSync for each test course", () => {
    fileOperations.scanCourses(inputPath, outputPath)
    expect(lstatSync).to.be.calledWithExactly(course1Path)
    expect(lstatSync).to.be.calledWithExactly(course2Path)
    expect(lstatSync).to.be.calledWithExactly(course3Path)
    expect(lstatSync).to.be.calledWithExactly(course4Path)
  })
})

describe("scanCourse", () => {
  let readFileSync, generateMarkdownFromJson
  const sandbox = sinon.createSandbox()
  const outputPath = tmp.dirSync({ prefix: "output" }).name

  beforeEach(async () => {
    readFileSync = sandbox.stub(fs, "readFileSync").returns(singleCourseRawData)
    generateMarkdownFromJson = sandbox.spy(
      markdownGenerators,
      "generateMarkdownFromJson"
    )
    await fileOperations.scanCourse(testDataPath, outputPath, singleCourseId)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls readFileSync on the master json file", () => {
    expect(readFileSync).to.be.calledWithExactly(singleCourseMasterJsonPath)
  })

  it("calls generateMarkdownFromJson on the course data", () => {
    expect(generateMarkdownFromJson).to.be.calledOnceWithExactly(
      singleCourseJsonData
    )
  })

  it("throws an error when you call it with a course that doesn't exist", async () => {
    await expect(
      fileOperations.scanCourse(testDataPath, outputPath, "test_missing")
    ).to.eventually.be.rejectedWith(
      `${path.join(
        testDataPath,
        "test_missing"
      )} - ${MISSING_COURSE_ERROR_MESSAGE}`
    )
  })
})

describe("getMasterJsonFileName", () => {
  it("gives the expected filename for a sample course", async () => {
    const masterJsonFileName = await fileOperations.getMasterJsonFileName(
      path.join(testDataPath, singleCourseId)
    )
    assert.equal(masterJsonFileName, singleCourseMasterJsonPath)
  })

  it("throws an error when you call it with nonexistent directory", async () => {
    await expect(
      fileOperations.getMasterJsonFileName(
        path.join(testDataPath, "test_missing")
      )
    ).to.eventually.be.rejectedWith(
      `${path.join(
        testDataPath,
        "test_missing"
      )} - ${MISSING_COURSE_ERROR_MESSAGE}`
    )
  })

  it("throws an error when you call it with a directory with no master json file", async () => {
    const emptyDirectory = path.join("test_data", "empty")
    await expect(
      fileOperations.getMasterJsonFileName(emptyDirectory)
    ).to.eventually.be.rejectedWith(
      `${emptyDirectory} - ${MISSING_COURSE_ERROR_MESSAGE}`
    )
  })
})

describe("writeMarkdownFilesRecursive", () => {
  let mkDirSync, writeFileSync, unlinkSync
  const sandbox = sinon.createSandbox()
  const outputPath = tmp.dirSync({ prefix: "output" }).name

  beforeEach(() => {
    mkDirSync = sandbox.spy(fs, "mkdirSync")
    writeFileSync = sandbox.spy(fs, "writeFileSync")
    unlinkSync = sandbox.spy(fs, "unlinkSync")
    fileOperations.writeMarkdownFilesRecursive(
      path.join(outputPath, singleCourseId),
      singleCourseMarkdownData
    )
  })

  afterEach(() => {
    sandbox.restore()
    rimraf.sync(path.join(outputPath, "*"))
  })

  it("calls mkDirSync to create sections folder", () => {
    expect(mkDirSync).to.be.calledWith(
      path.join(outputPath, singleCourseId, "sections")
    )
  })

  it("calls mkDirSync to create subfolders for sections with children", () => {
    singleCourseMarkdownData
      .filter(file => file["name"] !== "_index.md")
      .forEach(file => {
        if (file["children"].length > 0) {
          const child = singleCourseJsonData["course_pages"].filter(
            page =>
              path.join("sections", page["short_url"], "_index.md") ===
              file["name"]
          )[0]
          expect(mkDirSync).to.be.calledWith(
            helpers.pathToChildRecursive(
              path.join(outputPath, singleCourseId, "sections"),
              child,
              singleCourseJsonData
            )
          )
        }
      })
  })

  it("calls writeFileSync to create the course section markdown files", () => {
    singleCourseMarkdownData
      .filter(file => file["name"] !== "_index.md")
      .forEach(file => {
        expect(writeFileSync).to.be.calledWithExactly(
          path.join(outputPath, singleCourseId, file["name"]),
          file["data"]
        )
        if (file["children"].length > 0) {
          file["children"].forEach(child => {
            const childJson = singleCourseJsonData["course_pages"].filter(
              page =>
                `${helpers.pathToChildRecursive(
                  "sections",
                  page,
                  singleCourseJsonData
                )}.md` === child["name"]
            )[0]
            expect(writeFileSync).to.be.calledWithExactly(
              `${helpers.pathToChildRecursive(
                path.join(outputPath, singleCourseId, "sections"),
                childJson,
                singleCourseJsonData
              )}.md`,
              child["data"]
            )
          })
        }
      })
  })

  it("calls unlinkSync to remove files if they already exist", () => {
    fileOperations.writeMarkdownFilesRecursive(
      path.join(outputPath, singleCourseId),
      singleCourseMarkdownData
    )
    singleCourseMarkdownData
      .filter(file => file["name"] !== "_index.md")
      .forEach(file => {
        expect(unlinkSync).to.be.calledWithExactly(
          path.join(outputPath, singleCourseId, file["name"])
        )
        if (file["children"].length > 0) {
          file["children"].forEach(child => {
            const childJson = singleCourseJsonData["course_pages"].filter(
              page =>
                `${helpers.pathToChildRecursive(
                  "sections",
                  page,
                  singleCourseJsonData
                )}.md` === child["name"]
            )[0]
            expect(unlinkSync).to.be.calledWithExactly(
              `${helpers.pathToChildRecursive(
                path.join(outputPath, singleCourseId, "sections"),
                childJson,
                singleCourseJsonData
              )}.md`
            )
          })
        }
      })
  })
})
