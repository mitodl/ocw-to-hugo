const path = require("path")
const yaml = require("js-yaml")
const markdown = require("markdown-builder")
const TurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const { gfm, tables } = turndownPluginGfm

const {
  REPLACETHISWITHAPIPE,
  GETPAGESHORTCODESTART,
  GETPAGESHORTCODEEND
} = require("./constants")
const helpers = require("./helpers")
const loggers = require("./loggers")

const turndownService = new TurndownService({
  codeBlockStyle: "fenced"
})
turndownService.use(gfm)
turndownService.use(tables)

/**
 * Sanitize markdown table content
 **/
turndownService.addRule("table", {
  filter:      ["table"],
  replacement: (content, node, options) => {
    /**
     * Iterate the HTML node and replace all pipes inside table
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
 * fix some strangely formatted code blocks in OCW
 * see https://github.com/mitodl/hugo-course-publisher/issues/154
 * for discussion
 */
turndownService.addRule("codeblockfix", {
  filter: node =>
    node.nodeName === "PRE" &&
    node.firstChild &&
    node.firstChild.nodeName === "SPAN",
  replacement: (content, node, options) => {
    if (content.match(/\r?\n/)) {
      return `\n\n\`\`\`\n${content.replace(/`/g, "")}\n\`\`\`\n\n`
    } else {
      return content
    }
  }
})

/**
 * Build anchor link shortcodes
 **/
turndownService.addRule("anchorshortcode", {
  filter: (node, options) => {
    if (node.nodeName === "A" && node.getAttribute("name")) {
      return true
    }
    return false
  },
  replacement: (content, node, options) => {
    return `{{< anchor "${node.getAttribute("name")}" >}}`
  }
})

/**
 * Build links with Hugo shortcodes to course sections
 **/
turndownService.addRule("getpageshortcode", {
  filter: (node, options) => {
    if (node.nodeName === "A" && node.getAttribute("href")) {
      if (node.getAttribute("href").includes(GETPAGESHORTCODESTART)) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    const children = Array.prototype.slice.call(node.childNodes)
    if (!children.filter(child => child.nodeName === "IMG").length > 0) {
      // if this link doesn't contain an image, escape the content
      // except first make sure there are no pre-escaped square brackets
      content = turndownService.escape(
        content.replace(/\\\[/g, "[").replace(/\\\]/g, "]")
      )
    }
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

/**
 * Render h4 tags as an h5 instead
 */
turndownService.addRule("h4", {
  filter:      ["h4"],
  replacement: (content, node, options) => {
    return `##### ${content}`
  }
})

const fixLinks = (htmlStr, page, courseData) => {
  if (htmlStr) {
    htmlStr = helpers.resolveUids(htmlStr, page, courseData)
    htmlStr = helpers.resolveRelativeLinks(htmlStr, courseData)
    htmlStr = helpers.resolveYouTubeEmbed(htmlStr, courseData)
  }
  return htmlStr
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
      page["type"] !== "CourseHomeSection" &&
      page["type"] !== "DownloadSection"
  )
  return [
    {
      name: "_index.md",
      data: generateCourseHomeMarkdown(courseData)
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
      embeddedMedia["type"] = "course"
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
  const inRootNav = page["parent_uid"] === courseData["uid"]
  let courseSectionMarkdown = generateCourseSectionFrontMatter(
    page["title"],
    page["short_page_title"],
    `${page["uid"]}`,
    hasParent ? parent["uid"] : null,
    inRootNav,
    hasMedia,
    page["is_media_gallery"],
    (this["menuIndex"] + 1) * 10,
    page["list_in_left_nav"],
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
          loggers.fileLogger.log({
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
          loggers.fileLogger.log({
            level:   "error",
            message: err
          })
          return null
        }
      })
      .filter(media => media)
  }
}

const generateCourseHomeMarkdown = courseData => {
  /**
    Generate the front matter metadata for the course home page given course_data JSON
    */
  const courseHomePage = courseData["course_pages"].find(
    coursePage => coursePage["type"] === "CourseHomeSection"
  )
  const courseDescription = courseData["description"]
    ? turndownService.turndown(
      fixLinks(courseData["description"], courseHomePage, courseData)
    )
    : ""
  const otherInformationText = courseData["other_information_text"]
    ? turndownService.turndown(
      fixLinks(
        courseData["other_information_text"],
        courseHomePage,
        courseData
      )
    )
    : ""

  const frontMatter = {
    title:                      "Course Home",
    type:                       "course",
    layout:                     "course_home",
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
    course_info: {
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
    return `---\n${yaml.safeDump(
      frontMatter
    )}---\n${courseDescription}\n${otherInformationText}`
  } catch (err) {
    loggers.fileLogger.log({
      level:   "error",
      message: err
    })
    return null
  }
}

const generateCourseSectionFrontMatter = (
  title,
  shortTitle,
  pageId,
  parentId,
  inRootNav,
  hasMedia,
  isMediaGallery,
  menuIndex,
  listInLeftNav,
  courseId
) => {
  /**
    Generate the front matter metadata for a course section given a title and menu index
    */
  const courseSectionFrontMatter = {
    title:     title,
    course_id: courseId,
    type:      "course",
    layout:    "course_section"
  }

  if (inRootNav || listInLeftNav) {
    courseSectionFrontMatter["menu"] = {
      [courseId]: {
        identifier: pageId,
        name:       shortTitle,
        weight:     menuIndex
      }
    }
    if (parentId) {
      courseSectionFrontMatter["menu"][courseId]["parent"] = parentId
    }
  }

  if (hasMedia) {
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
    return `${turndownService.turndown(
      fixLinks(page["text"], page, courseData)
    )}${generateCourseFeaturesMarkdown(page, courseData)}`
  } catch (err) {
    loggers.fileLogger.log({
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
    type:          "course",
    layout:        "pdf",
    uid:           file["uid"],
    file_type:     file["file_type"],
    file_location: file["file_location"],
    course_id:     courseData["short_url"]
  }
  return `---\n${yaml.safeDump(pdfFrontMatter)}---\n`
}

const generateCourseFeaturesMarkdown = (page, courseData) => {
  let courseFeaturesMarkdown = ""
  if (page.hasOwnProperty("is_image_gallery")) {
    if (page["is_image_gallery"]) {
      const images = courseData["course_files"].filter(
        file =>
          file["parent_uid"] === page["uid"] && file["type"] === "OCWImage"
      )
      if (images.length > 0) {
        let baseUrl = ""
        const imageArgs = images.map(image => {
          const url = image["file_location"]
          if (baseUrl === "") {
            baseUrl = `${url.substring(0, url.lastIndexOf("/") + 1)}`
          }
          const fileName = url.substring(url.lastIndexOf("/") + 1, url.length)
          return {
            href:          fileName,
            "data-ngdesc": helpers.htmlSafeText(
              turndownService.turndown(image["description"])
            ),
            text: helpers.htmlSafeText(
              turndownService.turndown(image["caption"])
            )
          }
        })
        const imageShortcodes = imageArgs.map(
          args =>
            `{{< image-gallery-item ${Object.keys(args)
              .map(key => `${key}="${args[key]}"`)
              .join(" ")} >}}`
        )
        courseFeaturesMarkdown = `${courseFeaturesMarkdown}\n{{< image-gallery id="${
          page["uid"]
        }_nanogallery2" baseUrl="${baseUrl}" >}}\n${imageShortcodes.join(
          "\n"
        )}\n{{</ image-gallery >}}`
      }
    }
  }
  return courseFeaturesMarkdown
}

module.exports = {
  generateMarkdownFromJson,
  generateCourseHomeMarkdown,
  generateCourseSectionFrontMatter,
  generateCourseFeatures,
  generateCourseSectionMarkdown,
  generateCourseFeaturesMarkdown,
  turndownService
}
