const fsPromises = require("./fsPromises")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const tmp = require("tmp")
const rimraf = require("rimraf")
const yaml = require("js-yaml")

const {
  NO_COURSES_FOUND_MESSAGE,
  MISSING_COURSE_ERROR_MESSAGE,
  BOILERPLATE_MARKDOWN
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
const singleCourseRawData = require("fs").readFileSync(
  singleCourseMasterJsonPath
)
const singleCourseJsonData = JSON.parse(singleCourseRawData)
const singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
  singleCourseJsonData
)

describe("writeBoilerplate", () => {
  it("writes the files as expected", async () => {
    const outputPath = tmp.dirSync({ prefix: "output" }).name
    await fileOperations.writeBoilerplate(outputPath)
    for (const file of BOILERPLATE_MARKDOWN) {
      const expectedContent = `---\n${yaml.safeDump(file.content)}---\n`
      const tmpFileContents = await fsPromises.readFile(
        path.join(outputPath, file.path, file.name)
      )
      assert.equal(tmpFileContents, expectedContent)
    }
  })
})

describe("scanCourses", () => {
  let readdirStub, lstatStub, consoleLog
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
    readdirStub = sandbox.spy(fsPromises, "readdir")
    lstatStub = sandbox.spy(fsPromises, "lstat")
    consoleLog = sandbox.stub(console, "log")
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("throws an error when you call it with no input directory", async () => {
    try {
      await fileOperations.scanCourses(null, outputPath)
      assert.fail("No error thrown")
    } catch (err) {
      // all good
    }
  })

  it("throws an error when you call it with no output directory", async () => {
    try {
      await fileOperations.scanCourses(inputPath, null)
      assert.fail("No error thrown")
    } catch (err) {
      // all good
    }
  })

  it("displays an error when you call it with an empty courses.json", async () => {
    await fileOperations.scanCourses(inputPath, outputPath, {
      courses: "test_data/courses_blank.json"
    })
    expect(consoleLog).calledWithExactly(NO_COURSES_FOUND_MESSAGE)
  })

  it("displays an error when you call it with an empty input directory", async () => {
    await fileOperations.scanCourses("test_data/empty", outputPath)
    expect(consoleLog).calledWithExactly(NO_COURSES_FOUND_MESSAGE)
  })

  it("calls readdir nine times, once for courses and once for each course", async () => {
    await fileOperations.scanCourses(inputPath, outputPath)
    assert.equal(readdirStub.callCount, 9)
  })

  it("scans the four test courses and reports to console", async () => {
    await fileOperations.scanCourses(inputPath, outputPath)
    expect(consoleLog).calledWithExactly(logMessage)
  })

  it("calls lstatSync for each test course", async () => {
    await fileOperations.scanCourses(inputPath, outputPath)
    expect(lstatStub).to.be.calledWithExactly(course1Path)
    expect(lstatStub).to.be.calledWithExactly(course2Path)
    expect(lstatStub).to.be.calledWithExactly(course3Path)
    expect(lstatStub).to.be.calledWithExactly(course4Path)
  })
})

describe("scanCourse", () => {
  let readFileStub, generateMarkdownFromJson
  const sandbox = sinon.createSandbox()
  const outputPath = tmp.dirSync({ prefix: "output" }).name

  beforeEach(async () => {
    readFileStub = sandbox
      .stub(fsPromises, "readFile")
      .returns(Promise.resolve(singleCourseRawData))
    generateMarkdownFromJson = sandbox.spy(
      markdownGenerators,
      "generateMarkdownFromJson"
    )
    await fileOperations.scanCourse(testDataPath, outputPath, singleCourseId)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("calls readFileSync on the master json file", async () => {
    expect(readFileStub).to.be.calledWithExactly(singleCourseMasterJsonPath)
  })

  it("calls generateMarkdownFromJson on the course data", () => {
    expect(generateMarkdownFromJson).to.be.calledOnceWithExactly(
      singleCourseJsonData
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
})

describe("writeMarkdownFilesRecursive", () => {
  let mkDirStub, writeFileStub, unlinkStub
  const sandbox = sinon.createSandbox()
  const outputPath = tmp.dirSync({ prefix: "output" }).name

  beforeEach(async () => {
    mkDirStub = sandbox.spy(fsPromises, "mkdir")
    writeFileStub = sandbox.spy(fsPromises, "writeFile")
    unlinkStub = sandbox.spy(fsPromises, "unlink")
    await fileOperations.writeMarkdownFilesRecursive(
      path.join(outputPath, singleCourseId),
      singleCourseMarkdownData
    )
  })

  afterEach(() => {
    sandbox.restore()
    rimraf.sync(path.join(outputPath, "*"))
  })

  it("calls mkDirSync to create sections folder", () => {
    expect(mkDirStub).to.be.calledWith(
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
          expect(mkDirStub).to.be.calledWith(
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
        expect(writeFileStub).to.be.calledWithExactly(
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
            expect(writeFileStub).to.be.calledWithExactly(
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

  it("calls unlinkSync to remove files if they already exist", async () => {
    await fileOperations.writeMarkdownFilesRecursive(
      path.join(outputPath, singleCourseId),
      singleCourseMarkdownData
    )
    singleCourseMarkdownData
      .filter(file => file["name"] !== "_index.md")
      .forEach(file => {
        expect(unlinkStub).to.be.calledWithExactly(
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
            expect(unlinkStub).to.be.calledWithExactly(
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
