const fs = require("fs")
const path = require("path")
const sinon = require("sinon")
const { assert, expect } = require("chai").use(require("sinon-chai"))

const fileOperations = require("./file_operations")
const {
  generateDataTemplate,
  generateLegacyDataTemplate
} = require("./data_template_generators")
const helpers = require("./helpers")
const {
  readCourseJson,
  spaceSystemsId,
  classicalMechanicsId,
  physics801xId,
  physics802Id,
  foreignPolicyId,
  allCourseIds
} = require("./test_utils")

describe("generateDataTemplate", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog,
    pathLookup,
    spaceSystemsJsonData,
    mechanicsCourseJsonData,
    physicsCourseJsonData

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      allCourseIds
    )

    spaceSystemsJsonData = readCourseJson(spaceSystemsId)
    mechanicsCourseJsonData = readCourseJson(classicalMechanicsId)
    physicsCourseJsonData = readCourseJson(physics802Id)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("sets the course_title property to the title property of the course json data", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.equal(
      courseDataTemplate["course_title"],
      "Space Systems Engineering"
    )
  })

  it("sets the course_description property to the markdown converted course description and other information text", () => {
    spaceSystemsJsonData["description"] = "course description"
    spaceSystemsJsonData["other_information_text"] = "some other info"
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.equal(
      courseDataTemplate["course_description"],
      "course description\nsome other info"
    )
  })

  //
  ;["description", "other_information_text"].forEach(key => {
    [
      [
        true,
        `/courses/physics/${physics802Id}/acknowledgements.pdf`,
        "resources/acknowledgements"
      ],
      [
        false,
        "./resolveuid/63e325a780c79e352fb5bddb9b8b2c6a",
        `/courses/${classicalMechanicsId}/pages/week-1-kinematics`
      ]
    ].forEach(([sameCourse, url, expected]) => {
      it(`handles links properly in the course description, when the link is to ${
        sameCourse ? "the same" : "a different"
      } course, for key=${key}`, () => {
        physicsCourseJsonData = {
          ...physicsCourseJsonData,
          description:            "",
          other_information_text: "",
          [key]:                  `<p>(<a href="${url}">PDF</a>)</p>`
        }
        const courseDataTemplate = generateDataTemplate(
          physicsCourseJsonData,
          pathLookup
        )
        assert.include(
          courseDataTemplate["course_description"],
          `[PDF](${expected})`
        )
      })
    })
  })

  it("handles relative links properly in course descriptions", () => {
    spaceSystemsJsonData[
      "description"
    ] = `<a href="/courses/mechanical-engineering/${spaceSystemsId}/syllabus">syllabus</a>`
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.equal(
      courseDataTemplate["course_description"],
      "[syllabus](pages/syllabus)\n"
    )
  })

  it("sets various image properties correctly", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(courseDataTemplate["course_image"], {
      content: "2a01cea0-4000-d318-a1d6-3c46d451a0d4",
      website: "16-89j-space-systems-engineering-spring-2007"
    })
    assert.deepEqual(courseDataTemplate["course_image_thumbnail"], {
      content: "9136249e-26df-7962-1171-ddd1b58405a3",
      website: "16-89j-space-systems-engineering-spring-2007"
    })
  })

  it("sets an array of instructor uids under the instructors -> content property", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(courseDataTemplate["instructors"], {
      content: [
        "e042c8f9-995f-cc11-0a2a-5aafa674c5e6",
        "07d4f055-5edf-ebf2-c247-7bbf2d19dd91"
      ],
      website: "ocw-www"
    })
  })

  it("sets the department_numbers property to the department numbers found on the url property of the course json data", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(["16", "IDS"], courseDataTemplate["department_numbers"])
  })

  it("sets the learning_resource_types property to the processed list of course_feature_tags from the course json data", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(courseDataTemplate["learning_resource_types"], [
      "Projects with Examples",
      "Design Assignments",
      "Presentation Assignments with Examples",
      "Written Assignments with Examples"
    ])
  })

  it("sets the topics property on the course data template to a consolidated list of topics from the course_collections property of the course json data", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(courseDataTemplate["topics"], [
      ["Engineering", "Aerospace Engineering"],
      ["Engineering", "Systems Engineering"],
      ["Business", "Operations Management"]
    ])
  })

  it("sets the primary_course_number property on the course data template to data parsed from department_number and master_course_number in the course json data", () => {
    const expectedValue = helpers.getPrimaryCourseNumber(spaceSystemsJsonData)
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    const foundValues = courseDataTemplate["primary_course_number"]
    assert.equal(expectedValue, foundValues)
  })

  it("sets the term property on the course data template to from_semester and from_year in the course json data", () => {
    const expectedValue = spaceSystemsJsonData["from_semester"]
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    const foundValue = courseDataTemplate["term"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the year property", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    const foundValue = courseDataTemplate["year"]
    assert.equal("2007", foundValue)
  })

  describe("level", () => {
    [
      ["generateDataTemplate", generateDataTemplate],
      ["generateLegacyDataTemplate", generateLegacyDataTemplate]
    ].forEach(([generateFuncName, generateFunc]) => {
      describe(generateFuncName, () => {
        it("sets the level property", () => {
          const courseDataTemplate = generateFunc(
            spaceSystemsJsonData,
            pathLookup
          )
          const foundValue = courseDataTemplate["level"]
          assert.deepEqual(foundValue, ["Graduate"])
        })

        it("sets the level property to undergraduate and graduate if the level is Both", () => {
          spaceSystemsJsonData["course_level"] = "Both"
          const courseDataTemplate = generateFunc(
            spaceSystemsJsonData,
            pathLookup
          )
          const foundValue = courseDataTemplate["level"]
          assert.deepEqual(foundValue, ["Undergraduate", "Graduate"])
        })

        it("sets no level property if there is no level in the input data", () => {
          spaceSystemsJsonData["course_level"] = null
          const courseDataTemplate = generateFunc(
            spaceSystemsJsonData,
            pathLookup
          )
          const foundValue = courseDataTemplate["level"]
          assert.deepEqual(foundValue, [])
        })
      })
    })
  })

  it("sets the expected text in other_versions", () => {
    const expectedValue = [
      "[8.01X PHYSICS I: CLASSICAL MECHANICS WITH AN EXPERIMENTAL FOCUS](/courses/8-01x-physics-i-classical-mechanics-with-an-experimental-focus-fall-2002) |  FALL 2002"
    ]
    const courseDataTemplate = generateDataTemplate(
      mechanicsCourseJsonData,
      pathLookup
    )
    const foundValue = courseDataTemplate["other_versions"]
    assert.deepEqual(expectedValue, foundValue)
  })

  it("sets the expected text in other_versions which mentions scholars", () => {
    const json = readCourseJson(physics801xId)
    const template = generateDataTemplate(json, pathLookup)
    const expectedValue = [
      "[8.01SC CLASSICAL MECHANICS](/courses/8-01sc-classical-mechanics-fall-2016) | SCHOLAR,  FALL 2016"
    ]
    const foundValue = template["other_versions"]
    assert.deepEqual(expectedValue, foundValue)
  })

  it("sets archived versions with dspace urls", () => {
    const json = readCourseJson(foreignPolicyId)
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
    const courseDataTemplate = generateDataTemplate(
      mechanicsCourseJsonData,
      pathLookup
    )
    const foundValue = courseDataTemplate["open_learning_library_versions"]
    assert.deepEqual(expectedValue, foundValue)
  })

  it("sets the legacy_uid", () => {
    const expectedValue = "8f538d2a-785e-a37a-d301-33ad74e8e40e"
    const courseDataTemplate = generateDataTemplate(
      mechanicsCourseJsonData,
      pathLookup
    )
    const foundValue = courseDataTemplate["legacy_uid"]
    assert.deepEqual(expectedValue, foundValue)
  })
})

describe("generateLegacyDataTemplate", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog, courseDataTemplate, pathLookup, spaceSystemsJsonData

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
    spaceSystemsJsonData = readCourseJson(spaceSystemsId)
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [spaceSystemsId, classicalMechanicsId]
    )
    courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("sets various image properties correctly", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.equal(
      courseDataTemplate["course_image_url"],
      "https://open-learning-course-data-production.s3.amazonaws.com/16-89j-space-systems-engineering-spring-2007/2a01cea04000d318a1d63c46d451a0d4_16-89js07.jpg"
    )
    assert.equal(
      courseDataTemplate["course_thumbnail_image_url"],
      "https://open-learning-course-data-production.s3.amazonaws.com/16-89j-space-systems-engineering-spring-2007/9136249e26df79621171ddd1b58405a3_16-89js07-th.jpg"
    )
    assert.equal(
      courseDataTemplate["course_image_alternate_text"],
      "Artist's conception of astronauts setting up a lunar telescope array."
    )
    assert.equal(
      courseDataTemplate["course_image_caption_text"],
      "Astronauts setting up a lunar telescope array. (Image courtesy of [NASA](http://www.nasa.gov/mission_pages/exploration/multimedia/jfa18844_prt.htm).)"
    )
    assert.equal(
      courseDataTemplate["legacy_uid"],
      "f08ec502-e326-a719-48f2-92020efec938"
    )
  })

  it("sets the instructors property to the instructors found in the instuctors node of the course json data", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(courseDataTemplate["instructors"], [
      {
        first_name:      "Edward",
        last_name:       "Crawley",
        middle_initial:  "",
        salutation:      "Prof.",
        instructor:      "Prof. Edward Crawley",
        url:             "/search/?q=%22Prof.%20Edward%20Crawley%22",
        directory_title: "Professor",
        title:           "Crawley, Edward",
        department:      "Gordon Engineering Leadership Program",
        uid:             "e042c8f9-995f-cc11-0a2a-5aafa674c5e6"
      },
      {
        first_name:      "Olivier",
        last_name:       "de Weck",
        middle_initial:  "",
        salutation:      "Prof.",
        instructor:      "Prof. Olivier de Weck",
        url:             "/search/?q=%22Prof.%20Olivier%20de%20Weck%22",
        directory_title: "Associate Professor",
        title:           "de Weck, Olivier",
        department:      "Engineering Systems Division",
        uid:             "07d4f055-5edf-ebf2-c247-7bbf2d19dd91"
      }
    ])
  })

  it("sets the contributor_list proprety to the contributor_list found in the instuctors node of the course json data", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(
      courseDataTemplate["contributor_list"],
      spaceSystemsJsonData["contributor_list"]
    )
  })

  it("sets the publishdate property to the first_published_to_production property of the course json data", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.isTrue(
      courseDataTemplate["publishdate"].startsWith("2008-07-17T16:06:15")
    )
  })

  //
  ;[
    [true, "./resolveuid/244945a815a4b2a3af2a20384f403eab", "pages/projects"],
    [
      false,
      "./resolveuid/63e325a780c79e352fb5bddb9b8b2c6a",
      "/courses/8-01sc-classical-mechanics-fall-2016/pages/week-1-kinematics"
    ]
  ].forEach(([sameCourse, url, expected]) => {
    it(`handles links in the course_features property properly when the link is for ${
      sameCourse ? "the same" : "a different"
    } course`, () => {
      spaceSystemsJsonData["course_feature_tags"] = [
        {
          ocw_feature:       "Projects",
          ocw_subfeature:    "Examples",
          ocw_feature_url:   url,
          ocw_speciality:    "",
          ocw_feature_notes:
            "Projects section; projects files; file count: 16; file format: .pdf"
        }
      ]
      const courseDataTemplate = generateLegacyDataTemplate(
        spaceSystemsJsonData,
        pathLookup
      )
      assert.deepEqual(courseDataTemplate["course_features"], [
        {
          url: expected
        }
      ])
    })
  })

  it("sets the course_features property to the instructors found in the instuctors node of the course json data", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.deepEqual(courseDataTemplate["course_features"], [
      {
        feature: "Projects with Examples",
        url:     "pages/projects"
      },
      {
        feature: "Design Assignments",
        url:     "pages/assignments"
      },
      {
        feature: "Presentation Assignments with Examples",
        url:     "pages/projects"
      },
      {
        feature: "Written Assignments with Examples",
        url:     "pages/assignments"
      }
    ])
  })

  it("sets the department property to the department found on the url property of the course json data, title cased with hyphens replaced with spaces", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
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
})
