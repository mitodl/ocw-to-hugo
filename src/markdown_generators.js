#!/usr/bin/env node

const yaml = require("js-yaml")
const markdown = require("markdown-builder")
const titleCase = require("title-case")
const TurndownService = require("turndown")
const turndownService = new TurndownService()
turndownService.addRule("table", {
  filter:      ["table"],
  replacement: content => {
    return `{{< rawhtml >}}<table>${content}</table>{{< /rawhtml >}}`
  }
})
turndownService.addRule("th", {
  filter:      ["th"],
  replacement: content => {
    return `<th>${content}</th>`
  }
})
turndownService.addRule("tr", {
  filter:      ["tr"],
  replacement: content => {
    return `<tr>${content}</tr>`
  }
})
turndownService.addRule("td", {
  filter:      ["td"],
  replacement: content => {
    return `<td>${content}</td>`
  }
})
const helpers = require("./helpers")

const makeTopic = feature => {
  let topic = ""
  if (feature["ocw_feature"]) {
    topic += feature["ocw_feature"]
  }
  if (feature["ocw_subfeature"]) {
    topic += ` - ${feature["ocw_subfeature"]}`
  }
  return topic
}

const generateMarkdownFromJson = courseData => {
  /**
    This function takes JSON data parsed from a master.json file and returns markdown data
    */
  let courseHomeMarkdown = generateCourseHomeFrontMatter(courseData)
  courseHomeMarkdown += generateCourseFeatures(courseData)
  courseHomeMarkdown += generateCourseCollections(courseData)
  const coursePagesWithText = courseData["course_pages"].filter(
    page => page["text"]
  )
  return [
    {
      name: "_index.md",
      data: courseHomeMarkdown
    },
    ...coursePagesWithText.map((page, menuIndex) => {
      const pageName = page["short_url"]
      let courseSectionMarkdown = generateCourseSectionFrontMatter(
        page["title"],
        (menuIndex + 1) * 10
      )
      courseSectionMarkdown += generateCourseSectionMarkdown(page, courseData)
      return {
        name: `sections/${pageName}.md`,
        data: courseSectionMarkdown
      }
    })
  ]
}

const generateCourseHomeFrontMatter = courseData => {
  /**
    Generate the front matter metadata for the course home page given course_data JSON
    */

  let courseNumber = courseData["sort_as"]
  if (courseData["extra_course_number"]) {
    if (courseData["extra_course_number"]["sort_as_col"]) {
      courseNumber += ` / ${courseData["extra_course_number"]["sort_as_col"]}`
    }
  }
  const frontMatter = {
    title:              "Course Home",
    course_title:       courseData["title"],
    course_image_url:   helpers.getCourseImageUrl(courseData),
    course_description: courseData["description"],
    course_info:        {
      instructors: courseData["instructors"].map(
        instructor =>
          `Prof. ${instructor["first_name"]} ${instructor["last_name"]}`
      ),
      department: titleCase.titleCase(
        courseData["url"].split("/")[2].replace(/-/g, " ")
      ),
      topics:        courseData["course_collections"].map(makeTopic),
      course_number: courseNumber,
      term:          `${courseData["from_semester"]} ${courseData["from_year"]}`,
      level:         courseData["course_level"]
    },
    menu: {
      main: {
        weight: -10
      }
    }
  }
  return `---\n${yaml.safeDump(frontMatter)}---\n`
}

const generateCourseSectionFrontMatter = (title, menuIndex) => {
  /**
    Generate the front matter metadata for a course section given a title and menu index
    */
  return `---\n${yaml.safeDump({
    title: title,
    menu:  {
      main: {
        weight: menuIndex
      }
    }
  })}---\n`
}

const generateCourseFeatures = courseData => {
  /**
    Generate markdown for the "Course Features" section of the home page
    */
  const courseFeaturesHeader = markdown.headers.hX(5, "Course Features")
  const courseFeatures = courseData["course_features"].map(courseFeature => {
    const urlParts = courseFeature["ocw_feature_url"]
      .replace(/\/index.htm?l/, "/")
      .split("/")
    const url = urlParts[urlParts.length - 1]
    return markdown.misc.link(courseFeature["ocw_feature"], url)
  })
  return `${courseFeaturesHeader}\n${markdown.lists.ul(courseFeatures)}`
}

const generateCourseCollections = courseData => {
  /**
    Generate markdown for the "Course Collections" section of the home page
    */
  const courseCollectionsHeader = markdown.headers.hX(5, "Course Collections")
  const courseCollectionsSubHeader = `\nSee related courses in the following collections:\n\n${markdown.emphasis.i(
    "Find Courses by Topic"
  )}\n\n`
  const courseCollections = courseData["course_collections"].map(
    courseCollection => {
      const feature = courseCollection["ocw_feature"]
      const subfeature = courseCollection["ocw_subfeature"]
      const specialty = courseCollection["ocw_specialty"]
      let collection = feature
      if (subfeature) {
        collection = `${collection} > ${subfeature}`
      }
      if (specialty) {
        collection = `${collection} > ${specialty}`
      }
      return markdown.misc.link(collection, "#")
    }
  )
  return `${courseCollectionsHeader}${courseCollectionsSubHeader}${markdown.lists.ul(
    courseCollections
  )}`
}

const generateCourseSectionMarkdown = (page, courseData) => {
  /**
    Generate markdown a given course section page
    */
  let htmlStr = page["text"]
  courseData["course_pages"].forEach(coursePage => {
    const placeholder = `./resolveuid/${coursePage["uid"]}`
    if (htmlStr.includes(placeholder)) {
      htmlStr = htmlStr.replace(
        placeholder,
        `/sections/${coursePage["short_url"]}`
      )
    }
  })
  try {
    return turndownService.turndown(htmlStr)
  } catch (err) {
    return htmlStr
  }
}

module.exports = {
  generateMarkdownFromJson,
  generateCourseHomeFrontMatter,
  generateCourseSectionFrontMatter,
  generateCourseFeatures,
  generateCourseCollections,
  generateCourseSectionMarkdown
}
