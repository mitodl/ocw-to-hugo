const path = require("path")
const yaml = require("js-yaml")
const stripHtml = require("string-strip-html")

const { BASEURL_PLACEHOLDER_REGEX } = require("./constants")
const helpers = require("./helpers")
const loggers = require("./loggers")
const { html2markdown } = require("./turndown")

const fixLinks = (htmlStr, page, courseData, pathLookup) => {
  if (htmlStr && page) {
    const matchAndReplacements = [
      ...helpers.resolveUidMatches(htmlStr, page, courseData, pathLookup),
      ...helpers.resolveRelativeLinkMatches(htmlStr, courseData, pathLookup),
      ...helpers.resolveYouTubeEmbedMatches(htmlStr, courseData, pathLookup)
    ]
    htmlStr = helpers.applyReplacements(matchAndReplacements, htmlStr)
  }
  return htmlStr
}

const generateMarkdownFromJson = (courseData, pathLookup) => {
  /**
    This function takes JSON data parsed from a parsed.json file and returns markdown data
    */
  const rootSections = helpers.getRootSections(courseData)

  return [
    {
      name:  "_index.md",
      data:  generateCourseHomeMarkdown(courseData, pathLookup),
      files: generatePagePdfMarkdown(courseData, pathLookup)
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
    .filter(
      courseEmbeddedMedia => courseEmbeddedMedia["parent_uid"] === page["uid"]
    )
    .map(courseEmbeddedMedia => {
      const embeddedMediaItems = courseEmbeddedMedia["embedded_media"].map(
        embeddedMedia => {
          let technicalLocation = embeddedMedia["technical_location"]
          if (technicalLocation) {
            const replacement = helpers.resolveRelativeLink(
              technicalLocation,
              courseData,
              pathLookup,
              true
            )
            if (replacement) {
              technicalLocation = replacement
            }
          }

          if (technicalLocation) {
            return {
              ...embeddedMedia,
              technical_location: technicalLocation
            }
          } else {
            return embeddedMedia
          }
        }
      )

      return {
        ...courseEmbeddedMedia,
        course_id:      courseData["short_url"],
        type:           "course",
        layout:         "video",
        embedded_media: embeddedMediaItems
      }
    })
  const parents = courseData["course_pages"].filter(
    coursePage => coursePage["uid"] === page["parent_uid"]
  )
  const isParent = children.length > 0
  const hasFiles = pdfFiles.length > 0
  const hasMedia = coursePageEmbeddedMedia.length > 0
  const hasParent = parents.length > 0
  const parent = hasParent ? parents[0] : null
  const isInstructorInsightsSection =
    page["type"] === "ThisCourseAtMITSection" ||
    page["short_url"] === "instructor-insights" ||
    (hasParent && parent["type"] === "ThisCourseAtMITSection") ||
    (hasParent && parent["short_url"] === "instructor-insights")
  const layout = isInstructorInsightsSection
    ? "instructor_insights"
    : "course_section"
  let courseSectionMarkdown = generateCourseSectionFrontMatter(
    page["title"],
    hasParent ? parent["uid"] : null,
    hasParent ? parent["title"] : null,
    layout,
    page["uid"],
    page["is_media_gallery"],
    courseData["short_url"]
  )
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
    children: children.map(
      page => generateMarkdownRecursive(page, courseData, pathLookup),
      this
    ),
    files: pdfFiles
      .map(file => {
        try {
          if (file["id"]) {
            return {
              name: `${path.join(
                pathToChild,
                helpers.stripPdfSuffix(file["id"])
              )}.md`,
              data: generatePdfMarkdown(file, courseData)
            }
          }
        } catch (err) {
          loggers.fileLogger.error(err)
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
          loggers.fileLogger.error(err)
          return null
        }
      })
      .filter(media => media)
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

  const pageId = courseHomePage ? courseHomePage["uid"] : ""
  const frontMatter = {
    uid:       pageId,
    title:     "",
    type:      "course",
    layout:    "course_home",
    course_id: courseData["short_url"]
  }
  try {
    return `---\n${yaml.safeDump(frontMatter)}---\n`
  } catch (err) {
    loggers.fileLogger.error(err)
    return null
  }
}

const generatePagePdfMarkdown = (courseData, pathLookup) => {
  /**
   * Generate markdown files representing PDF viewer pages for PDF's mentioned on a page in the site
   */

  return courseData["course_files"]
    .filter(
      file =>
        file["file_type"] === "application/pdf" &&
        pathLookup.byUid[file["parent_uid"]]
    )
    .map(file => {
      const { path: parentPath } = pathLookup.byUid[file["parent_uid"]]
      return {
        name: `${path.join(parentPath, helpers.stripPdfSuffix(file["id"]))}.md`,
        data: generatePdfMarkdown(file, courseData)
      }
    })
}

const generateCourseSectionFrontMatter = (
  title,
  parentUid,
  parentTitle,
  layout,
  pageId,
  isMediaGallery,
  courseId
) => {
  /**
    Generate the front matter metadata for a course section
    */
  const courseSectionFrontMatter = {
    uid:       pageId,
    title:     title,
    course_id: courseId,
    type:      "course",
    layout:    layout
  }

  if (parentUid) {
    courseSectionFrontMatter["parent_uid"] = parentUid
  }
  if (parentTitle) {
    courseSectionFrontMatter["parent_title"] = parentTitle
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
    parent_uid:    file["parent_uid"],
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

const generateCourseDescription = (courseData, pathLookup) => {
  const courseHomePage = courseData["course_pages"].find(
    coursePage =>
      coursePage["type"] === "CourseHomeSection" ||
      coursePage["type"] === "SRHomePage"
  )
  const courseDescription = courseData["description"]
    ? html2markdown(
      helpers.rootRelativeToDocumentRelative(
        fixLinks(
          courseData["description"],
          courseHomePage,
          courseData,
          pathLookup
        )
      )
    )
    : ""
  const otherInformationText = courseData["other_information_text"]
    ? html2markdown(
      helpers.rootRelativeToDocumentRelative(
        fixLinks(
          courseData["other_information_text"],
          courseHomePage,
          courseData,
          pathLookup
        )
      )
    )
    : ""
  try {
    return `${courseDescription}\n${otherInformationText}`
  } catch (err) {
    loggers.fileLogger.error(err)
    return null
  }
}

module.exports = {
  generateMarkdownFromJson,
  generateCourseHomeMarkdown,
  generatePagePdfMarkdown,
  generateCourseSectionFrontMatter,
  generateCourseSectionMarkdown,
  generateCourseFeaturesMarkdown,
  generateCourseDescription,
  fixLinks
}
