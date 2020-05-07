#!/usr/bin/env node

const path = require("path")
const yaml = require("js-yaml")
const markdown = require("markdown-builder")
const TurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const { gfm, tables } = turndownPluginGfm

const helpers = require("./helpers")
const loggers = require("./loggers")

const turndownService = new TurndownService()
turndownService.use(gfm)
turndownService.use(tables)

const REPLACETHISWITHAPIPE = "REPLACETHISWITHAPIPE"
const GETPAGESHORTCODESTART = "GETPAGESHORTCODESTART"
const GETPAGESHORTCODEEND = "GETPAGESHORTCODEEND"

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
      if (node.getAttribute("href").includes(GETPAGESHORTCODESTART)) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    content = turndownService.escape(content)
    const ref = turndownService
      .escape(
        node
          .getAttribute("href")
          .replace(GETPAGESHORTCODESTART, '{{% getpage "')
          .replace(GETPAGESHORTCODEEND, '" %}}')
      )
      .split("\\_")
      .join("_")
    return `[${content}](${ref})`
  }
})

const fixLinks = (page, courseData) => {
  let htmlStr = page["text"]
  if (htmlStr) {
    const coursePages = courseData["course_pages"].filter(
      page => page["type"] !== "CourseHomeSection"
    )
    coursePages.forEach(coursePage => {
      const children = courseData["course_pages"].filter(
        coursePage => coursePage["parent_uid"] === page["uid"]
      )
      const pdfFiles = courseData["course_files"].filter(
        file =>
          file["file_type"] === "application/pdf" &&
          file["parent_uid"] === coursePage["uid"]
      )
      const isParent = children.length > 0
      const hasFiles = pdfFiles.length > 0
      const suffix = isParent || hasFiles ? "/_index.md" : ""
      const pagePath = `${helpers.pathToChildRecursive(
        path.join("courses", courseData["short_url"], "sections"),
        coursePage,
        courseData
      )}${suffix}`
      const placeholder = new RegExp(
        `\\.?\\/?resolveuid\\/${coursePage["uid"]}`,
        "g"
      )
      htmlStr = htmlStr.replace(
        placeholder,
        `${GETPAGESHORTCODESTART}${pagePath}${GETPAGESHORTCODEEND}`
      )
      pdfFiles.forEach(pdfFile => {
        const placeholder = new RegExp(
          `\\.?\\/?resolveuid\\/${pdfFile["uid"]}`,
          "g"
        )
        const pdfPath = `${pagePath.replace("/_index.md", "/")}${pdfFile["id"]}`
        htmlStr = htmlStr.replace(
          placeholder,
          `${GETPAGESHORTCODESTART}${pdfPath.replace(
            ".pdf",
            ""
          )}${GETPAGESHORTCODEEND}`
        )
      })
    })
    courseData["course_files"].forEach(media => {
      if (media["file_type"] !== "application/pdf") {
        const placeholder = new RegExp(
          `\\.?\\/?resolveuid\\/${media["uid"]}`,
          "g"
        )
        htmlStr = htmlStr.replace(placeholder, `${media["file_location"]}`)
      }
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
  } else return ""
}

const generateMarkdownFromJson = courseData => {
  /**
    This function takes JSON data parsed from a master.json file and returns markdown data
    */
  this["courseData"] = courseData
  this["menuIndex"] = 0
  const rootSections = courseData["course_pages"].filter(
    page =>
      page["parent_uid"] === courseData["uid"] &&
      page["type"] !== "CourseHomeSection"
  )
  return [
    {
      name: "_index.md",
      data: generateCourseHomeFrontMatter(courseData)
    },
    ...rootSections.map(generateMarkdownRecursive, this)
  ]
}

const generateMarkdownRecursive = page => {
  const courseData = this["courseData"]
  const children = courseData["course_pages"].filter(
    coursePage => coursePage["parent_uid"] === page["uid"]
  )
  const pdfFiles = courseData["course_files"].filter(
    file =>
      file["file_type"] === "application/pdf" &&
      file["parent_uid"] === page["uid"]
  )
  const coursePageEmbeddedMedia = Object.values(
    courseData["course_embedded_media"]
  )
    .map(embeddedMedia => {
      embeddedMedia["type"] = "courses"
      embeddedMedia["layout"] = "video"
      return embeddedMedia
    })
    .filter(embeddedMedia => embeddedMedia["parent_uid"] === page["uid"])
  const parents = courseData["course_pages"].filter(
    coursePage => coursePage["uid"] === page["parent_uid"]
  )
  const isParent = children.length > 0
  const hasFiles = pdfFiles.length > 0
  const hasMedia = coursePageEmbeddedMedia.length > 0
  const hasParent = parents.length > 0
  const parent = hasParent ? parents[0] : null
  let courseSectionMarkdown = generateCourseSectionFrontMatter(
    page["title"],
    `${page["uid"]}`,
    hasParent ? `${parent["uid"]}` : null,
    hasMedia,
    page["is_media_gallery"],
    (this["menuIndex"] + 1) * 10,
    courseData["short_url"]
  )
  this["menuIndex"]++
  courseSectionMarkdown += generateCourseSectionMarkdown(page, courseData)
  const pathToChild = `${helpers.pathToChildRecursive(
    "sections/",
    page,
    courseData
  )}`
  return {
    name:
      isParent || hasFiles || hasMedia
        ? path.join(pathToChild, "_index.md")
        : `${pathToChild}.md`,
    data:     courseSectionMarkdown,
    children: children.map(generateMarkdownRecursive, this),
    files:    pdfFiles
      .map(file => {
        try {
          if (file["id"]) {
            return {
              name: `${path.join(
                pathToChild,
                file["id"].replace(".pdf", "")
              )}.md`,
              data: generatePdfMarkdown(file, courseData)
            }
          }
        } catch (err) {
          loggers.errorLogger.log({
            level:   "error",
            message: err
          })
          return null
        }
      })
      .filter(file => file),
    media: coursePageEmbeddedMedia
      .map(media => {
        try {
          if (media["short_url"]) {
            return {
              name: `${path.join(pathToChild, media["short_url"])}.md`,
              data: `---\n${yaml.safeDump(media)}---\n`
            }
          }
        } catch (err) {
          loggers.errorLogger.log({
            level:   "error",
            message: err
          })
          return null
        }
      })
      .filter(media => media)
  }
}

const generateCourseHomeFrontMatter = courseData => {
  /**
    Generate the front matter metadata for the course home page given course_data JSON
    */

  const frontMatter = {
    title:                      "Course Home",
    course_id:                  courseData["short_url"],
    course_title:               courseData["title"],
    course_image_url:           courseData["image_src"] ? courseData["image_src"] : "",
    course_thumbnail_image_url: courseData["thumbnail_image_src"]
      ? courseData["thumbnail_image_src"]
      : "",
    course_image_alternate_text: courseData["image_alternate_text"]
      ? courseData["image_alternate_text"]
      : "",
    course_image_caption_text: courseData["image_caption_text"]
      ? courseData["image_caption_text"]
      : "",
    course_description: courseData["description"],
    course_info:        {
      instructors: courseData["instructors"].map(
        instructor =>
          `Prof. ${instructor["first_name"]} ${instructor["last_name"]}`
      ),
      departments:     helpers.getDepartments(courseData),
      course_features: courseData["course_features"].map(courseFeature =>
        helpers.getCourseFeatureObject(courseFeature)
      ),
      topics:         helpers.getConsolidatedTopics(courseData["course_collections"]),
      course_numbers: helpers.getCourseNumbers(courseData),
      term:           `${courseData["from_semester"]} ${courseData["from_year"]}`,
      level:          courseData["course_level"]
    },
    menu: {
      [courseData["short_url"]]: {
        identifier: "course-home",
        weight:     -10
      }
    }
  }
  try {
    return `---\n${yaml.safeDump(frontMatter)}---\n`
  } catch (err) {
    loggers.errorLogger.log({
      level:   "error",
      message: err
    })
    return null
  }
}

const generateCourseSectionFrontMatter = (
  title,
  pageId,
  parentId,
  hasMedia,
  isMediaGallery,
  menuIndex,
  courseId
) => {
  /**
    Generate the front matter metadata for a course section given a title and menu index
    */
  const courseSectionFrontMatter = {
    title:     title,
    course_id: courseId,
    menu:      {
      [courseId]: {
        identifier: pageId,
        weight:     menuIndex
      }
    }
  }
  if (parentId) {
    courseSectionFrontMatter["menu"][courseId]["parent"] = parentId
  }
  if (hasMedia) {
    courseSectionFrontMatter["type"] = "courses"
    courseSectionFrontMatter["layout"] = "videogallery"
  }
  if (isMediaGallery) {
    courseSectionFrontMatter["is_media_gallery"] = true
  }
  return `---\n${yaml.safeDump(courseSectionFrontMatter)}---\n`
}

const generateCourseFeatures = courseData => {
  /**
    Generate markdown for the "Course Features" section of the home page
    */
  const courseFeaturesHeader = markdown.headers.hX(5, "Course Features")
  const courseFeatures = courseData["course_features"]
    .map(courseFeature => {
      const section = helpers.getCourseSectionFromFeatureUrl(courseFeature)
      const matchingSections = courseData["course_pages"].filter(
        coursePage => coursePage["short_url"] === section
      )
      if (section && matchingSections.length > 0) {
        return markdown.misc.link(
          courseFeature["ocw_feature"],
          `{{% ref "${helpers.pathToChildRecursive(
            path.join("courses", courseData["short_url"], "sections"),
            matchingSections[0],
            courseData
          )}" %}}`
        )
      } else return null
    })
    .filter(courseFeature => courseFeature)
  return `${courseFeaturesHeader}\n${markdown.lists.ul(courseFeatures)}`
}

const generateCourseSectionMarkdown = (page, courseData) => {
  /**
    Generate markdown a given course section page
    */
  try {
    return turndownService.turndown(fixLinks(page, courseData))
  } catch (err) {
    loggers.errorLogger.log({
      level:   "error",
      message: err
    })
    return page["text"]
  }
}

const generatePdfMarkdown = (file, courseData) => {
  /**
  Generate the front matter metadata for a PDF file
  */
  const pdfFrontMatter = {
    title:         file["title"],
    description:   file["description"],
    type:          "courses",
    layout:        "pdf",
    uid:           file["uid"],
    file_type:     file["file_type"],
    file_location: file["file_location"],
    course_id:     courseData["short_url"]
  }
  return `---\n${yaml.safeDump(pdfFrontMatter)}---\n`
}

module.exports = {
  generateMarkdownFromJson,
  generateCourseHomeFrontMatter,
  generateCourseSectionFrontMatter,
  generateCourseFeatures,
  generateCourseSectionMarkdown
}
