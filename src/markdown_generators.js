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

const getYoutubeEmbedHtml = media => {
  const youTubeMedia = media["embedded_media"].filter(embeddedMedia => {
    return embeddedMedia["id"] === "Video-YouTube-Stream"
  })
  return youTubeMedia.map(embeddedMedia => {
    return `<div class="text-center"><iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${embeddedMedia["media_info"]}" frameborder="0" allow="encrypted-media; picture-in-picture"></iframe></div>`
  }).join("")
}

const fixLinks = (htmlStr, courseData) => {
  if (htmlStr) {
    courseData["course_pages"].forEach(page => {
      const placeholder = new RegExp(`\\.?\\/?resolveuid\\/${page["uid"]}`)
      htmlStr = htmlStr.replace(
        placeholder,
        `{{<ref "sections/${page["short_url"]}">}}`
      )
    })
    courseData["course_files"].forEach(media => {
      const placeholder = new RegExp(`\\.?\\/?resolveuid\\/${media["uid"]}`)
      htmlStr = htmlStr.replace(placeholder, `${media["file_location"]}`)
    })
    Object.keys(courseData["course_embedded_media"]).forEach(key => {
      if (htmlStr.indexOf(key) !== -1) {
        htmlStr = htmlStr.replace(
          key,
          getYoutubeEmbedHtml(courseData["course_embedded_media"][key])
        )
      }
    })

    return htmlStr
  }
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
      topics:        courseData["course_collections"].map(helpers.makeTopic),
      course_number: helpers.getCourseNumber(courseData),
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
    return markdown.misc.link(
      courseFeature["ocw_feature"],
      helpers.getCourseSectionFromFeatureUrl(courseFeature)
    )
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
      return markdown.misc.link(
        helpers.getCourseCollectionText(courseCollection),
        "#"
      )
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
    return turndownService.turndown(fixLinks(htmlStr, courseData))
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
