#!/usr/bin/env node

const path = require("path")
const yaml = require("js-yaml")
const markdown = require("markdown-builder")
const titleCase = require("title-case")
const TurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const helpers = require("./helpers")
const { gfm, tables } = turndownPluginGfm
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
    content = content
      // First, isolate the table by getting the contents between the first and last pipe
      .substring(content.indexOf("|"), content.lastIndexOf("|"))
      // Second, replace all newlines and carriage returns with line break shortcodes
      .replace(/\r?\n|\r/g, "{{< br >}}")
      /**
       * Third, replace all line break shortcodes in between two pipes with a newline
       * character between two pipes to recreate the rows
       */
      .replace(/\|{{< br >}}\|/g, "|\n|")
      // Fourth, replace the pipe marker we added earlier with the HTML character entity for a pipe
      .replace(/REPLACETHISWITHAPIPE/g, "&#124;")
    /**
     * This finds table header rows by matching a cell with only one bold string.
     * Regex breakdown by capturing group:
     * 1. Positive lookbehind that finds a pipe followed by a space and two asterisks
     * 2. Matches any amount of alphanumeric characters
     * 3. Positive lookahead that matches two asterisks followed by a space, a pipe and
     * a newline or carriage return
     */
    if (content.match(/(?<=\| \*\*)(.*?)(?=\*\* \|\r?\n|\r)/g)) {
      // Get the amount of columns by matching three hyphens and counting
      const totalColumns = content.match(/---/g || []).length
      // Split headers out on their own so they aren't in one cell
      return (
        content
        /**
           * First, replace pipe space and double asterisk with a newline
           * followed by double asterisk
           */

          .replace(/\| \*\*/g, "\n**")
          /**
           * Second, replace double asterisk space pipe followed by a newline
           * or carriage return with double asterisk double newline.  After the
           * second newline, re-initialize the table by iterating a pipe followed
           * by a space and three hyphens for the total amount of columns, finally
           * closing it out with a single pipe at the end
           */
          .replace(
            /\*\* \|\r?\n|\r/g,
            `**\n\n${"| ".repeat(totalColumns)}|\n${"| --- ".repeat(
              totalColumns
            )}|`
          )
          /**
           * Finally, reconstruct the table by inserting line breaks in between
           * back-to-back pipes to re-create rows
           */
          .replace(/\|\|/g, "|\n|")
      )
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
        .replace(REFSHORTCODESTART, '{{% ref "')
        .replace(REFSHORTCODEEND, '" %}}')
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
  const rootSections = courseData["course_pages"].filter(
    page => page["parent_uid"] === courseData["uid"]
  )
  let menuIndex = 0
  return [
    {
      name: "_index.md",
      data: courseHomeMarkdown
    },
    ...rootSections.map(page => {
      const pageName = page["short_url"]
      let courseSectionMarkdown = generateCourseSectionFrontMatter(
        page["title"],
        page["short_url"],
        (menuIndex + 1) * 10,
        courseData["short_url"]
      )
      menuIndex++
      courseSectionMarkdown += generateCourseSectionMarkdown(page, courseData)
      const children = courseData["course_pages"].filter(
        childPage => childPage["parent_uid"] === page["uid"]
      )
      return {
        name:
          children.length > 0
            ? `sections/${pageName}/_index.md`
            : `sections/${pageName}.md`,
        data:     courseSectionMarkdown,
        children: generateChildMarkdownRecursive(
          page,
          children,
          menuIndex,
          courseData
        )
      }
    })
  ]
}

const generateChildMarkdownRecursive = (
  parent,
  children,
  menuIndex,
  courseData
) => {
  return children.map(child => {
    let courseSectionMarkdown = generateCourseSectionFrontMatter(
      child["title"],
      child["short_url"],
      (menuIndex + 1) * 10,
      courseData["short_url"]
    )
    menuIndex++
    courseSectionMarkdown += generateCourseSectionMarkdown(child, courseData)
    const grandChildren = courseData["course_pages"].filter(
      grandChild => grandChild["parent_uid"] === child["uid"]
    )
    const pathToChild = `${helpers.pathToChildRecursive(
      "sections/",
      child,
      courseData
    )}`
    return {
      name:
        grandChildren.length > 0
          ? path.join(pathToChild, "_index.md")
          : `${pathToChild}.md`,
      data:     courseSectionMarkdown,
      children: generateChildMarkdownRecursive(
        child,
        grandChildren,
        menuIndex,
        courseData
      )
    }
  })
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
  const courseFeatures = courseData["course_features"]
    .map(courseFeature => {
      const section = helpers.getCourseSectionFromFeatureUrl(courseFeature)
      const matchingSectionsWithText = courseData["course_pages"].filter(
        coursePage => coursePage["text"] && coursePage["short_url"] === section
      )
      if (section && matchingSectionsWithText.length > 0) {
        return markdown.misc.link(
          courseFeature["ocw_feature"],
          `{{% ref "sections/${section}" %}}`
        )
      } else return null
    })
    .filter(courseFeature => courseFeature)
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
