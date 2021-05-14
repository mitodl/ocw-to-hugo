const fsPromises = require("./fsPromises")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))
const tmp = require("tmp")
const rimraf = require("rimraf")

const {
  FILE_TYPE,
  NO_COURSES_FOUND_MESSAGE,
  PAGE_TYPE,
  COURSE_TYPE,
  EMBEDDED_MEDIA_PAGE_TYPE
} = require("./constants")
const helpers = require("./helpers")
const fileOperations = require("./file_operations")
const markdownGenerators = require("./markdown_generators")
const configGenerators = require("./config_generators")
const dataTemplateGenerators = require("./data_template_generators")

describe("file operations", () => {
  const testDataPath = "test_data/courses"
  const singleCourseId =
    "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
  const unpublishedCourseId = "18-435j-quantum-computation-fall-2018"
  const singleCourseMasterJsonPath = path.join(
    testDataPath,
    singleCourseId,
    `${singleCourseId}_parsed.json`
  )
  let singleCourseRawData,
    singleCourseJsonData,
    singleCourseMarkdownData,
    pathLookup

  beforeEach(async () => {
    singleCourseRawData = require("fs").readFileSync(singleCourseMasterJsonPath)
    singleCourseJsonData = JSON.parse(singleCourseRawData)
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [singleCourseId]
    )
    singleCourseMarkdownData = markdownGenerators.generateMarkdownFromJson(
      singleCourseJsonData,
      pathLookup
    )
  })

  describe("scanCourses", () => {
    let readdirStub, lstatStub, consoleLog
    const sandbox = sinon.createSandbox()
    const inputPath = "test_data/courses"
    const outputPath = tmp.dirSync({ prefix: "output" }).name
    const courseLogMessage = "Converting 12 courses to Hugo markdown..."
    const pathsLogMessage = "Generated 2220 paths."
    const course1Name =
      "1-00-introduction-to-computers-and-engineering-problem-solving-spring-2012"
    const course1Path = path.join(inputPath, course1Name)
    const course2Path = path.join(
      inputPath,
      "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"
    )
    const course3Path = path.join(inputPath, "ec-711-d-lab-energy-spring-2011")
    const course4Path = path.join(
      inputPath,
      "12-001-introduction-to-geology-fall-2013"
    )

    beforeEach(() => {
      readdirStub = sandbox.spy(fsPromises, "readdir")
      lstatStub = sandbox.spy(fsPromises, "lstat")
      consoleLog = sandbox.stub(console, "log")

      helpers.runOptions.courses = null
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
      helpers.runOptions.courses = "test_data/courses_blank.json"
      await fileOperations.scanCourses(inputPath, outputPath)
      expect(consoleLog).calledWithExactly(NO_COURSES_FOUND_MESSAGE)
    })

    it("errors when reading a course without a master JSON file", async () => {
      const coursesPath = tmp.dirSync({ prefix: "output" }).name
      await fsPromises.mkdir(path.join(coursesPath, course1Name))
      helpers.runOptions.courses = "test_data/courses.json"
      try {
        await fileOperations.scanCourses(coursesPath, outputPath)
        assert.fail("No exception")
      } catch (err) {
        assert.include(
          err.message,
          `${course1Name} - Specified course was not found.`
        )
      }
    })

    it("doesn't error when reading a course without a master JSON file, if the courses option wasn't set", async () => {
      const coursesPath = tmp.dirSync({ prefix: "output" }).name
      await fsPromises.mkdir(path.join(coursesPath, course1Name))
      await fileOperations.scanCourses(coursesPath, outputPath)
    })

    it("throws an error when you call it with an empty input directory", async () => {
      helpers.runOptions.courses = "test_data/courses.json"
      return expect(
        fileOperations.scanCourses("test_data/empty", outputPath)
      ).to.eventually.be.rejectedWith(
        `Missing course directory for ${course1Name}`
      )
    })

    it("skips an empty input directory", async () => {
      await fileOperations.scanCourses("test_data/empty", outputPath)
      expect(consoleLog).calledWithExactly(
        "No courses found!  For more information, see README.md"
      )
    })

    it("calls readdir many times, once for courses and once for each course", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      assert.equal(readdirStub.callCount, 25)
    }).timeout(5000)

    it("scans the four test courses and reports to console", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      expect(consoleLog).calledWithExactly(courseLogMessage)
    }).timeout(5000)

    it("reports the correct amount of paths found to the console", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      expect(consoleLog).calledWithExactly(pathsLogMessage)
    }).timeout(5000)

    it("calls lstat for each test course", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      expect(lstatStub).to.be.calledWithExactly(course1Path)
      expect(lstatStub).to.be.calledWithExactly(course2Path)
      expect(lstatStub).to.be.calledWithExactly(course3Path)
      expect(lstatStub).to.be.calledWithExactly(course4Path)
    }).timeout(5000)
  })

  describe("scanCourse", () => {
    let readFileStub,
      generateMarkdownFromJson,
      writeExternalLinks,
      generateDataTemplate
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
      writeExternalLinks = sandbox.spy(
        configGenerators,
        "generateExternalLinksMenu"
      )
      generateDataTemplate = sandbox.spy(
        dataTemplateGenerators,
        "generateDataTemplate"
      )
    })

    afterEach(() => {
      sandbox.restore()
    })

    it("calls readFile on the master json file", async () => {
      await fileOperations.scanCourse(
        testDataPath,
        outputPath,
        singleCourseId,
        pathLookup
      )
      expect(readFileStub).to.be.calledWithExactly(singleCourseMasterJsonPath)
    }).timeout(5000)

    it("calls generateMarkdownFromJson on the course data", async () => {
      await fileOperations.scanCourse(
        testDataPath,
        outputPath,
        singleCourseId,
        pathLookup
      )
      expect(generateMarkdownFromJson).to.be.calledOnceWithExactly(
        singleCourseJsonData,
        pathLookup
      )
    }).timeout(5000)

    it("calls writeExternalLinks on the course data", async () => {
      await fileOperations.scanCourse(
        testDataPath,
        outputPath,
        singleCourseId,
        pathLookup
      )
      expect(writeExternalLinks).to.be.calledOnceWithExactly(
        singleCourseJsonData
      )
    }).timeout(5000)

    it("calls generateDataTemplate on the course data", async () => {
      await fileOperations.scanCourse(
        testDataPath,
        outputPath,
        singleCourseId,
        pathLookup
      )
      expect(generateDataTemplate).to.be.calledOnceWithExactly(
        singleCourseJsonData,
        pathLookup
      )
    }).timeout(5000)

    it("skips a course that has been unpublished", async () => {
      readFileStub.restore()
      await fileOperations.scanCourse(
        testDataPath,
        outputPath,
        unpublishedCourseId,
        pathLookup
      )
      expect(generateMarkdownFromJson).to.be.not.called
      expect(generateDataTemplate).to.be.not.called
    }).timeout(5000)
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

    it("calls mkDir to create sections folder", () => {
      expect(mkDirStub).to.be.calledWith(
        path.join(outputPath, singleCourseId, "sections")
      )
    })

    it("calls mkDir to create subfolders for sections with children", () => {
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
              path.join(outputPath, singleCourseId, "sections")
            )
          }
        })
    })

    it("calls writeFile to create the course section markdown files", () => {
      for (const file of singleCourseMarkdownData) {
        const filePath = path.join(
          outputPath,
          "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009",
          file["name"]
        )
        expect(writeFileStub).to.be.calledWith(filePath, file["data"])
      }
    })
  })

  describe("buildPathsForAllCourses", () => {
    it("builds some paths", async () => {
      const pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        [
          singleCourseId,
          unpublishedCourseId,
          "12-001-introduction-to-geology-fall-2013",
          "ec-711-d-lab-energy-spring-2011"
        ]
      )
      const uids = pathLookup.byUid
      assert.deepEqual(uids["93e58d46191f9fc3c54ec80752ad3b80"], {
        course:       "12-001-introduction-to-geology-fall-2013",
        path:         "/sections/lecture-notes-and-slides/MIT12_001F13_Lec5Notes.pdf",
        fileType:     "application/pdf",
        id:           "MIT12_001F13_Lec5Notes.pdf",
        parentUid:    "7a74d241d2fe5d877f747158998d8ed3",
        fileLocation:
          "https://open-learning-course-data-production.s3.amazonaws.com/12-001-introduction-to-geology-fall-2013/93e58d46191f9fc3c54ec80752ad3b80_MIT12_001F13_Lec5Notes.pdf",
        uid:  "93e58d46191f9fc3c54ec80752ad3b80",
        type: FILE_TYPE
      })
      assert.deepEqual(uids["877f0e43412db8b16e5b2864cf8bf1cc"], {
        course:
          "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009",
        path:      "/sections/labs",
        type:      PAGE_TYPE,
        parentUid: "e395587c58555f1fe564e8afd75899e6",
        uid:       "877f0e43412db8b16e5b2864cf8bf1cc"
      })
      assert.deepEqual(uids["d9aad1541f1a9d3c0f7b0dcf9531a9a1"], {
        course: "12-001-introduction-to-geology-fall-2013",
        path:   "/",
        type:   COURSE_TYPE,
        uid:    "d9aad1541f1a9d3c0f7b0dcf9531a9a1"
      })
      assert.deepEqual(uids["b03952e4bdfcea4962271aeae1dedb3f"], {
        course:    "ec-711-d-lab-energy-spring-2011",
        path:      "/sections/intro-energy-basics-human-power/lab-1-human-power",
        type:      EMBEDDED_MEDIA_PAGE_TYPE,
        parentUid: "32a22e0de0add67342ce41445297fce7",
        uid:       "b03952e4bdfcea4962271aeae1dedb3f"
      })
      assert.isUndefined(uids[unpublishedCourseId])

      const pathsByCourse = pathLookup.byCourse
      assert.lengthOf(Object.values(pathsByCourse), 4)
      const paths = pathsByCourse["ec-711-d-lab-energy-spring-2011"]
      assert.lengthOf(paths, 77)
      for (const pathObj of paths) {
        assert.deepEqual(pathObj, uids[pathObj.uid])
      }
    })

    it("builds a masterSubject lookup with two courses linked by master_subject", async () => {
      const pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        [
          "8-02-physics-ii-electricity-and-magnetism-spring-2007",
          "8-02x-physics-ii-electricity-magnetism-with-an-experimental-focus-spring-2005"
        ]
      )
      assert.lengthOf(
        pathLookup.byMasterSubject["206222b741b31eab7b4b2771202c4bbd"],
        2
      )
      assert.equal(
        pathLookup.byMasterSubject["206222b741b31eab7b4b2771202c4bbd"][0][
          "course_id"
        ],
        "8-02-physics-ii-electricity-and-magnetism-spring-2007"
      )
      assert.equal(
        pathLookup.byMasterSubject["206222b741b31eab7b4b2771202c4bbd"][1][
          "course_id"
        ],
        "8-02x-physics-ii-electricity-magnetism-with-an-experimental-focus-spring-2005"
      )
    })
  })
})
