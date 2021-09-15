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
    const courseLogMessage = "Converting 17 courses to Hugo markdown..."
    const pathsLogMessage = "Generated 3471 paths."
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

    it("calls readdir many times", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      assert.equal(readdirStub.callCount, 86)
    }).timeout(10000)

    it("scans the test courses and reports to console", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      expect(consoleLog).calledWithExactly(courseLogMessage)
    }).timeout(10000)

    it("reports the correct amount of paths found to the console", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      expect(consoleLog).calledWithExactly(pathsLogMessage)
    }).timeout(10000)

    it("calls lstat for each test course", async () => {
      await fileOperations.scanCourses(inputPath, outputPath)
      expect(lstatStub).to.be.calledWithExactly(course1Path)
      expect(lstatStub).to.be.calledWithExactly(course2Path)
      expect(lstatStub).to.be.calledWithExactly(course3Path)
      expect(lstatStub).to.be.calledWithExactly(course4Path)
    }).timeout(10000)
  })

  describe("scanCourse", () => {
    let readFileStub,
      generateMarkdownFromJson,
      generateMenuItems,
      generateDataTemplate,
      generateLegacyDataTemplate
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
      generateMenuItems = sandbox.spy(configGenerators, "generateMenuItems")
      generateDataTemplate = sandbox.spy(
        dataTemplateGenerators,
        "generateDataTemplate"
      )
      generateLegacyDataTemplate = sandbox.spy(
        dataTemplateGenerators,
        "generateLegacyDataTemplate"
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
    }).timeout(10000)

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
    }).timeout(10000)

    it("calls writeExternalLinks on the course data", async () => {
      await fileOperations.scanCourse(
        testDataPath,
        outputPath,
        singleCourseId,
        pathLookup
      )
      expect(generateMenuItems).to.be.calledOnceWithExactly(
        singleCourseJsonData,
        pathLookup
      )
    }).timeout(10000)

    it("calls generateDataTemplate and generateLegacyDataTemplate on the course data", async () => {
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
      expect(generateLegacyDataTemplate).to.be.calledWithExactly(
        singleCourseJsonData,
        pathLookup
      )
    }).timeout(10000)

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
    }).timeout(10000)
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

    it("calls mkDir to create pages folder", () => {
      expect(mkDirStub).to.be.calledWith(
        path.join(outputPath, singleCourseId, "pages")
      )
    })

    it("calls mkDir to create subfolders for pages with children", () => {
      singleCourseMarkdownData
        .filter(file => file["name"] !== "_index.md")
        .forEach(file => {
          if (file["children"].length > 0) {
            const child = singleCourseJsonData["course_pages"].filter(
              page =>
                path.join("pages", page["short_url"], "_index.md") ===
                file["name"]
            )[0]
            expect(mkDirStub).to.be.calledWith(
              path.join(outputPath, singleCourseId, "pages")
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
        course:        "12-001-introduction-to-geology-fall-2013",
        unalteredPath:
          "/pages/lecture-notes-and-slides/MIT12_001F13_Lec5Notes.pdf",
        path:         "/pages/lecture-notes-and-slides/mit12_001f13_lec5notes",
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
        path:          "/pages/labs",
        unalteredPath: "/pages/labs",
        type:          PAGE_TYPE,
        parentUid:     "e395587c58555f1fe564e8afd75899e6",
        uid:           "877f0e43412db8b16e5b2864cf8bf1cc"
      })
      assert.deepEqual(uids["d9aad1541f1a9d3c0f7b0dcf9531a9a1"], {
        course:               "12-001-introduction-to-geology-fall-2013",
        path:                 "/",
        unalteredPath:        "/",
        type:                 COURSE_TYPE,
        uid:                  "d9aad1541f1a9d3c0f7b0dcf9531a9a1",
        department_number:    "12",
        from_semester:        "Fall",
        from_year:            "2013",
        master_course_number: "001",
        short_url:            "12-001-introduction-to-geology-fall-2013",
        title:                "Introduction to Geology",
        published:            true
      })
      assert.deepEqual(uids["b03952e4bdfcea4962271aeae1dedb3f"], {
        course:        "ec-711-d-lab-energy-spring-2011",
        path:          "/pages/intro-energy-basics-human-power/lab-1-human-power",
        unalteredPath:
          "/pages/intro-energy-basics-human-power/lab-1-human-power",
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
      const courseList = [
        "8-01x-physics-i-classical-mechanics-with-an-experimental-focus-fall-2002",
        "8-01sc-classical-mechanics-fall-2016"
      ]
      const pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        courseList
      )
      assert.deepEqual(
        pathLookup.coursesByMasterSubject[
          "977c90d0c4bb1443f1edd0cdc3ad25c3"
        ].map(_uid => pathLookup.byUid[_uid]["short_url"]),
        courseList
      )
    })

    it("builds an archive lookup", async () => {
      const courseList = [
        "17-40-american-foreign-policy-past-present-and-future-fall-2017",
        "17-40-american-foreign-policy-past-present-future-fall-2010",
        "17-40-american-foreign-policy-past-present-and-future-fall-2004",
        "17-40-american-foreign-policy-past-present-and-future-fall-2002"
      ]
      const pathLookup = await fileOperations.buildPathsForAllCourses(
        "test_data/courses",
        courseList
      )
      assert.deepEqual(pathLookup.archivedCoursesByCourse, {
        "17-40-american-foreign-policy-past-present-and-future-fall-2017": [
          {
            uid:       "63f8b9a35b43334791ef00ce6c390d63",
            dspaceUrl: "https://dspace.mit.edu/handle/1721.1/116542"
          },
          {
            uid:       "871cd91454dc801a6d59bb24b474ec67",
            dspaceUrl: "https://dspace.mit.edu/handle/1721.1/71203"
          },
          {
            uid:       "a291b546e0a4d15375ed0d04b236da5a",
            dspaceUrl: "https://dspace.mit.edu/handle/1721.1/35797"
          }
        ],
        "17-40-american-foreign-policy-past-present-future-fall-2010": [
          {
            uid:       "871cd91454dc801a6d59bb24b474ec67",
            dspaceUrl: "https://dspace.mit.edu/handle/1721.1/71203"
          },
          {
            uid:       "a291b546e0a4d15375ed0d04b236da5a",
            dspaceUrl: "https://dspace.mit.edu/handle/1721.1/35797"
          }
        ],
        "17-40-american-foreign-policy-past-present-and-future-fall-2004": [
          {
            uid:       "a291b546e0a4d15375ed0d04b236da5a",
            dspaceUrl: "https://dspace.mit.edu/handle/1721.1/35797"
          }
        ],
        "17-40-american-foreign-policy-past-present-and-future-fall-2002": []
      })
    })
  })
})
