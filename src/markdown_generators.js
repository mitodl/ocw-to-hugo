const path = require("path")
const yaml = require("js-yaml")
const markdown = require("markdown-builder")
const titleCase = require("title-case")
const TurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const helpers = require("./helpers")
const stats = require("./stats")
const { gfm, tables } = turndownPluginGfm
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

const helpers = require("./helpers")
const loggers = require("./loggers")
const { html2markdown } = require("./turndown")

const fixLinks = (htmlStr, page, courseData, pathLookup) => {
  if (htmlStr && page) {
    const matchAndReplacements = [
      ...helpers.resolveUidMatches(htmlStr, page, courseData, pathLookup),
      ...helpers.resolveRelativeLinkMatches(htmlStr, courseData, pathLookup),
      ...helpers.resolveYouTubeEmbedMatches(htmlStr, courseData)
    ]
    htmlStr = helpers.applyReplacements(matchAndReplacements, htmlStr)

    // this will be merged into resolveRelativeLinkMatches in a future PR
    htmlStr = htmlStr.replace(/http:\/\/ocw.mit.edu/g, "")
  }
  return htmlStr
}

const generateMarkdownFromJson = (courseData, verbose = false) => {
  /**
    This function takes JSON data parsed from a parsed.json file and returns markdown data
    */
  this["menuIndex"] = 0
  this["verbose"] = verbose
  if (this["verbose"]) {
    const titleLength = courseData["title"].length
    if (titleLength > stats.get("longest-course-title")) {
      stats.set("longest-course-title", titleLength)
    } else if (
      titleLength < stats.get("shortest-course-title") ||
      stats.get("shortest-course-title") === 0
    ) {
      stats.set("shortest-course-title", titleLength)
    }
  }
  const rootSections = courseData["course_pages"].filter(
    page =>
      page["parent_uid"] === courseData["uid"] &&
      page["type"] !== "CourseHomeSection" &&
      page["type"] !== "SRHomePage" &&
      page["type"] !== "DownloadSection"
  )

  return [
    {
      name:  "_index.md",
      data:  generateCourseHomeMarkdown(courseData, pathLookup),
      files: generateCourseHomePdfMarkdown(courseData, pathLookup)
    },
    ...rootSections.map(
      page => generateMarkdownRecursive(page, courseData, pathLookup),
      this
    )
  ]
}

const generateMarkdownRecursive = (page, courseData, pathLookup) => {
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
      embeddedMedia["course_id"] = courseData["short_url"]
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
  if (this["verbose"]) {
    const titleLength = page["title"].length
    if (titleLength > stats.get("longest-section-title")) {
      stats.set("longest-section-title", titleLength)
    } else if (
      titleLength < stats.get("shortest-section-title") ||
      stats.get("shortest-section-title") === 0
    ) {
      stats.set("shortest-section-title", titleLength)
    }
  }
  let courseSectionMarkdown = generateCourseSectionFrontMatter(
    page["title"],
    hasParent ? parent["title"] : null,
    layout,
    page["short_page_title"],
    page["uid"],
    hasParent ? parent["uid"] : null,
    inRootNav,
    page["is_media_gallery"],
    (this["menuIndex"] + 1) * 10,
    page["list_in_left_nav"],
    courseData["short_url"]
  )
  this["menuIndex"]++
  courseSectionMarkdown += generateCourseSectionMarkdown(
    page,
    courseData,
    pathLookup
  )
  const { path: childPath } = pathLookup.byUid[page["uid"]]
  const pathToChild = helpers.stripSlashPrefix(childPath)
  return {
    name:
      isParent || hasFiles || hasMedia
        ? path.join(pathToChild, "_index.md")
        : `${pathToChild}.md`,
    data:     courseSectionMarkdown,
    children: children.map(generateMarkdownRecursive, this),
    files:    pdfFiles.map(file => {
      if (this["verbose"] && file["title"]) {
        const titleLength = file["title"].length
        if (titleLength > stats.get("longest-pdf-title")) {
          stats.set("longest-pdf-title", titleLength)
        } else if (
          titleLength < stats.get("shortest-pdf-title") ||
          stats.get("shortest-pdf-title") === 0
        ) {
          stats.set("shortest-pdf-title", titleLength)
        }
      }
      return {
        name: `${path.join(
          pathToChild,
          helpers.fileNameFromUrl(file["file_location"]).replace(".pdf", "")
        )}.md`,
        data: generatePdfMarkdown(file, courseData)
      }
    }, this)
  }
}

const generateCourseHomeMarkdown = (courseData, pathLookup) => {
  /**
    Generate the front matter metadata for the course home page given course_data JSON
    */
  const courseHomePage = courseData["course_pages"].find(
    coursePage =>
      coursePage["type"] === "CourseHomeSection" ||
      coursePage["type"] === "SRHomePage"
  )
  const courseDescription = courseData["description"]
    ? html2markdown(
      fixLinks(
        courseData["description"],
        courseHomePage,
        courseData,
        pathLookup
      )
    )
    : ""
  const otherInformationText = courseData["other_information_text"]
    ? html2markdown(
      fixLinks(
        courseData["other_information_text"],
        courseHomePage,
        courseData,
        pathLookup
      )
    )
    : ""

  const pageId = courseHomePage ? courseHomePage["uid"] : ""
  const frontMatter = {
    title:                       "Course Home",
    course_id:                   courseData["short_url"],
    course_title:                courseData["title"],
    course_image_url:            courseData["image_src"],
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
    console.log(err)
    console.log(frontMatter)
  }
}

const generateCourseSectionFrontMatter = (
  title,
  parentTitle,
  layout,
  shortTitle,
  pageId,
  parentId,
  inRootNav,
  isMediaGallery,
  menuIndex,
  listInLeftNav,
  courseId
) => {
  /**
    Generate the front matter metadata for a course section given a title and menu index
    */
  const courseSectionFrontMatter = {
    uid:       pageId,
    title:     title,
    course_id: courseId,
    type:      "course",
    layout:    layout
  }

  if (parentTitle) {
    courseSectionFrontMatter["parent_title"] = parentTitle
  }

  if (inRootNav || listInLeftNav) {
    courseSectionFrontMatter["menu"] = {
      [courseId]: {
        identifier: pageId,
        name:       shortTitle || "",
        weight:     menuIndex
      }
    }
    if (parentId) {
      courseSectionFrontMatter["menu"][courseId]["parent"] = parentId
    }
  }

  if (isMediaGallery) {
    courseSectionFrontMatter["is_media_gallery"] = true
  }
  return `---\n${yaml.safeDump(courseSectionFrontMatter)}---\n`
}

const formatHTMLMarkDown = (page, courseData, section, pathLookup) => {
  return page[section]
    ? `\n${helpers.unescapeBackticks(
      html2markdown(
        fixLinks(page[section] || "", page, courseData, pathLookup)
      )
    )}`
    : ""
}

const generateCourseSectionMarkdown = (page, courseData, pathLookup) => {
  /**
    Generate markdown a given course section page
    */
  try {
    return `${formatHTMLMarkDown(
      page,
      courseData,
      "text",
      pathLookup
    )}${generateCourseFeaturesMarkdown(
      page,
      courseData,
      pathLookup
    )}${formatHTMLMarkDown(page, courseData, "bottomtext", pathLookup)}`
  } catch (err) {
    loggers.fileLogger.error(err)
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
    file_location: helpers.stripS3(file["file_location"]),
    course_id:     courseData["short_url"]
  }
  return `---\n${yaml.safeDump(pdfFrontMatter)}---\n`
}

const generateVideoGalleryMarkdown = (page, courseData, pathLookup) => {
  const videos = Object.values(courseData["course_embedded_media"]).filter(
    obj => obj["parent_uid"] === page["uid"]
  )

  return videos
    .map(video => {
      const { path: videoUrl } = pathLookup.byUid[video["uid"]]
      const videoArgs = {
        href:    videoUrl,
        section: helpers.htmlSafeText(
          helpers.unescapeBackticks(html2markdown(page.title))
        ),
        title: helpers.htmlSafeText(
          helpers.unescapeBackticks(html2markdown(video.title))
        ),
        description: helpers.htmlSafeText(
          helpers.unescapeBackticks(
            stripHtml(video["about_this_resource_text"]).result
          )
        )
      }
      for (const media of video.embedded_media) {
        if (media.type === "Thumbnail" && media.media_location) {
          videoArgs.thumbnail = media.media_location
        }
      }
      const keys = Object.keys(videoArgs)
        .map(key => `${key}="${videoArgs[key]}"`)
        .join(" ")
      return `{{< video-gallery-item ${keys} >}}`
    })
    .join(" ")
}

const generateImageGalleryMarkdown = (page, courseData) => {
  let courseFeaturesMarkdown = ""
  const images = courseData["course_files"].filter(
    file => file["parent_uid"] === page["uid"] && file["type"] === "OCWImage"
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
          helpers.unescapeBackticks(html2markdown(image["description"]))
        ),
        text: helpers.htmlSafeText(
          helpers.unescapeBackticks(html2markdown(image["caption"]))
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
    }_nanogallery2" baseUrl="${helpers.stripS3(
      baseUrl
    )}" >}}\n${imageShortcodes.join("\n")}\n{{</ image-gallery >}}`
  }
  return courseFeaturesMarkdown
}

const generateCourseFeaturesMarkdown = (page, courseData, pathLookup) => {
  if (page.hasOwnProperty("is_image_gallery") && page["is_image_gallery"]) {
    return generateImageGalleryMarkdown(page, courseData)
  } else if (
    page.hasOwnProperty("is_media_gallery") &&
    page["is_media_gallery"]
  ) {
    return generateVideoGalleryMarkdown(page, courseData, pathLookup)
  }
  return ""
}

module.exports = {
  generateMarkdownFromJson,
  generateCourseHomeMarkdown,
  generateCourseHomePdfMarkdown,
  generateCourseSectionFrontMatter,
  generateCourseSectionMarkdown,
  generateCourseFeaturesMarkdown,
  fixLinks
}
