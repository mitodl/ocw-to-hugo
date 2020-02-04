#!/usr/bin/env node

const yaml = require("js-yaml")
const markdown = require("markdown-builder")
const titleCase = require("title-case")
const TurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const helpers = require("./helpers")
const gfm = turndownPluginGfm.gfm
const tables = turndownPluginGfm.tables
const turndownService = new TurndownService()
turndownService.use(gfm)
turndownService.use(tables)

const REPLACETHISWITHAPIPE = "REPLACETHISWITHAPIPE"
const REFSHORTCODESTART = "REFSHORTCODESTART"
const REFSHORTCODEEND = "REFSHORTCODEEND"

/**
 * Sanitize markdown table content
 **/
turndownService.addRule("table", {
  filter:      ["table"],
  replacement: (content, node, options) => {
    /**
     * Interate the HTML node and replace all pipes inside table
     * cells with a marker we'll use later
     */
    for (let i = 0; i < node.rows.length; i++) {
      const cells = node.rows[i].cells
      for (let j = 0; j < cells.length; j++) {
        cells[j].innerHTML = cells[j].innerHTML.replace(
          /\|/g,
          REPLACETHISWITHAPIPE
        )
      }
    }
    // Regenerate markdown for this table with cell edits
    content = turndownService.turndown(node)
    /**
     * Get the bounds of the table, remove all line breaks, then
     * from earlier with the HTML character entity for a pipe
     * reintroduce them between rows, replacing our pipe marker
     */
    content = content
      .substring(content.indexOf("|"), content.lastIndexOf("|"))
      .replace(/\r?\n|\r/g, "<br>")
      .replace(/\|<br>\|/g, "|\n|")
      .replace(/REPLACETHISWITHAPIPE/g, "&#124;")
    // Only do this if header lines are found
    if (content.match(/(?<=\| \*\*)(.*?)(?=\*\* \|\r?\n|\r)/g)) {
      // Get the amount of columns
      const totalColumns = content.match(/---/g || []).length
      // Split headers out on their own so they aren't in one cell
      return content
        .replace(/\| \*\*/g, "\n**")
        .replace(
          /\*\* \|\r?\n|\r/g,
          `**\n\n${"| ".repeat(totalColumns)}|\n${"| --- ".repeat(
            totalColumns
          )}|`
        )
        .replace(/\|\|/g, "|\n|")
    } else return content
  }
})

/**
 * Build links with Hugo shortcodes to course sections
 **/
turndownService.addRule("refshortcode", {
  filter: (node, options) => {
    if (node.nodeName === "A" && node.getAttribute("href")) {
      if (node.getAttribute("href").includes(REFSHORTCODESTART)) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    content = turndownService.escape(content)
    const ref = turndownService.escape(
      node
        .getAttribute("href")
        .replace(REFSHORTCODESTART, '{{< ref "')
        .replace(REFSHORTCODEEND, '" >}}')
    )
    return `[${content}](${ref})`
  }
})

const fixLinks = (page, courseData) => {
  let htmlStr = page["text"]
  if (htmlStr) {
    const coursePagesWithText = courseData["course_pages"].filter(
      page => page["text"]
    )
    coursePagesWithText.forEach(coursePage => {
      const placeholder = new RegExp(
        `\\.?\\/?resolveuid\\/${coursePage["uid"]}`,
        "g"
      )
      const prefix =
        page["title"] === "Course Home" && coursePage["title"] !== "Course Home"
          ? "sections/"
          : ""
      htmlStr = htmlStr.replace(
        placeholder,
        `REFSHORTCODESTART${prefix}${coursePage["short_url"]}REFSHORTCODEEND`
      )
    })
    courseData["course_files"].forEach(media => {
      const placeholder = new RegExp(
        `\\.?\\/?resolveuid\\/${media["uid"]}`,
        "g"
      )
      htmlStr = htmlStr.replace(placeholder, `${media["file_location"]}`)
    })
    Object.keys(courseData["course_embedded_media"]).forEach(key => {
      if (htmlStr.includes(key)) {
        htmlStr = htmlStr.replace(
          key,
          helpers.getYoutubeEmbedHtml(courseData["course_embedded_media"][key])
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
        page["short_url"],
        (menuIndex + 1) * 10,
        courseData["short_url"]
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
    course_id:          courseData["short_url"],
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
      [courseData["short_url"]]: {
        identifier: "course-home",
        weight:     -10
      }
    }
  }
  return `---\n${yaml.safeDump(frontMatter)}---\n`
}

const generateCourseSectionFrontMatter = (
  title,
  pageId,
  menuIndex,
  courseId
) => {
  /**
    Generate the front matter metadata for a course section given a title and menu index
    */
  return `---\n${yaml.safeDump({
    title: title,
    menu:  {
      [courseId]: {
        identifier: pageId,
        weight:     menuIndex
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
  try {
    return turndownService.turndown(fixLinks(page, courseData))
  } catch (err) {
    return page["text"]
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
