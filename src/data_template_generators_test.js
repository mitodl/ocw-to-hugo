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
      '<p>Astronauts setting up a lunar telescope array. (Image courtesy of <a href="http://www.nasa.gov/mission_pages/exploration/multimedia/jfa18844_prt.htm">NASA</a>.)</p>'
    )
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
      {
        subtopics: [
          {
            specialities: [],
            subtopic:     "Aerospace Engineering",
            url:          "/search/?t=Aerospace%20Engineering"
          },
          {
            specialities: [],
            subtopic:     "Systems Engineering",
            url:          "/search/?t=Systems%20Engineering"
          }
        ],
        topic: "Engineering",
        url:   "/search/?t=Engineering"
      },
      {
        subtopics: [
          {
            specialities: [],
            subtopic:     "Operations Management",
            url:          "/search/?t=Operations%20Management"
          }
        ],
        topic: "Business",
        url:   "/search/?t=Business"
      }
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
    const expectedValue = `${spaceSystemsJsonData["from_semester"]} ${spaceSystemsJsonData["from_year"]}`
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    const foundValue = courseDataTemplate["term"]
    assert.equal(expectedValue, foundValue)
  })

  it("sets the level property on the course data template to course_level in the course json data", () => {
    const courseDataTemplate = generateDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    const foundValue = courseDataTemplate["level"]
    assert.equal(foundValue, "Graduate")
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
})

describe("generateLegacyDataTemplate", () => {
  const sandbox = sinon.createSandbox()
  let consoleLog, courseDataTemplate, pathLookup, spaceSystemsJsonData

  beforeEach(async () => {
    consoleLog = sandbox.stub(console, "log")
    spaceSystemsJsonData = readCourseJson(spaceSystemsId)
    pathLookup = await fileOperations.buildPathsForAllCourses(
      "test_data/courses",
      [spaceSystemsId]
    )
    courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("sets the instructors property to the instructors found in the instuctors node of the course json data", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
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

  it("sets the publishdate property to the first_published_to_production property of the course json data", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    assert.isTrue(
      courseDataTemplate["publishdate"].startsWith("2008-07-17T16:06:15")
    )
  })

  it("sets the level property on the course data template to course_level in the course json data", () => {
    const courseDataTemplate = generateLegacyDataTemplate(
      spaceSystemsJsonData,
      pathLookup
    )
    const level = spaceSystemsJsonData["course_level"]
    const foundValue = courseDataTemplate["level"]
    assert.deepEqual(
      {
        level: level,
        url:   "/search/?l=Graduate"
      },
      foundValue
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
