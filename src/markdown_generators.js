const path = require("path")
const yaml = require("js-yaml")
const stripHtml = require("string-strip-html")

const helpers = require("./helpers")
const loggers = require("./loggers")
const { html2markdown } = require("./turndown")
const {
  RESOURCE_TYPE_IMAGE,
  RESOURCE_TYPE_VIDEO,
  VIDEO_EMBEDDED_MEDIA_IDS
} = require("./constants")

const fixLinks = (
  htmlStr,
  courseData,
  pathLookup,
  useShortcodes,
  isRelativeToRoot
) => {
  if (htmlStr) {
    const matchAndReplacements = [
      ...helpers.resolveUidMatches(
        htmlStr,
        courseData,
        pathLookup,
        useShortcodes,
        isRelativeToRoot
      ),
      ...helpers.resolveRelativeLinkMatches(
        htmlStr,
        courseData,
        pathLookup,
        useShortcodes,
        isRelativeToRoot
      ),
      ...helpers.resolveYouTubeEmbedMatches(
        htmlStr,
        courseData,
        pathLookup,
        useShortcodes,
        isRelativeToRoot
      )
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
    ...rootSections.map(
      page => generateMarkdownRecursive(page, courseData, pathLookup),
      this
    ),
    ...generateResourceMarkdown(courseData, pathLookup)
  ]
}

const generateResourceMarkdown = (courseData, pathLookup) => {
  const filesMarkdown = courseData["course_files"].map(file => {
    try {
      const { path: resourcePath } = pathLookup.byUid[file["uid"]]

      return {
        name: `${resourcePath}.md`,
        data: generateResourceMarkdownForFile(file, courseData, pathLookup)
      }
    } catch (err) {
      loggers.fileLogger.error(err)
      return null
    }
  })
  const mediaMarkdown = Object.values(courseData["course_embedded_media"])
    .filter(
      media =>
        media["embedded_media"].filter(embeddedMedia =>
          VIDEO_EMBEDDED_MEDIA_IDS.has(embeddedMedia["id"])
        ).length > 0
    )
    .map(media => {
      try {
        const { path: resourcePath } = pathLookup.byUid[media["uid"]]

        return {
          name: `${resourcePath}.md`,
          data: generateResourceMarkdownForVideo(media, courseData, pathLookup)
        }
      } catch (err) {
        loggers.fileLogger.error(err)
        return null
      }
    })

  return [...filesMarkdown, ...mediaMarkdown].filter(Boolean)
}

const generateMarkdownRecursive = (page, courseData, pathLookup) => {
  const pages = courseData["course_pages"].filter(
    coursePage => coursePage["parent_uid"] === page["uid"]
  )
  const parents = courseData["course_pages"].filter(
    coursePage => coursePage["uid"] === page["parent_uid"]
  )
  const hasPages = pages.length > 0
  const hasParent = parents.length > 0
  const parent = hasParent ? parents[0] : null
  const isInstructorInsightsSection =
    page["type"] === "ThisCourseAtMITSection" ||
    page["short_url"] === "instructor-insights" ||
    (hasParent && parent["type"] === "ThisCourseAtMITSection") ||
    (hasParent && parent["short_url"] === "instructor-insights")
  const layout = isInstructorInsightsSection ? "instructor_insights" : null
  let courseSectionMarkdown = generateCourseSectionFrontMatter(
    page["title"],
    hasParent ? parent["uid"] : null,
    hasParent ? parent["title"] : null,
    hasParent ? parent["type"] : null,
    layout,
    page["uid"],
    courseData["short_url"],
    page["is_media_gallery"],
    helpers.getVideoUidsFromPage(page, courseData),
    page["type"]
  )
  courseSectionMarkdown += generateCourseSectionMarkdown(
    page,
    courseData,
    pathLookup
  )
  const { path: childPath } = pathLookup.byUid[page["uid"]]
  const pathToChild = helpers.stripSlashPrefix(childPath)
  return {
    name:     hasPages ? path.join(pathToChild, "_index.md") : `${pathToChild}.md`,
    data:     courseSectionMarkdown,
    children: pages.map(
      child => generateMarkdownRecursive(child, courseData, pathLookup),
      this
    )
  }
}

const generateCourseSectionFrontMatter = (
  title,
  parentUid,
  parentTitle,
  parentType,
  layout,
  pageId,
  courseId,
  isMediaGallery,
  videoUids,
  type
) => {
  /**
    Generate the front matter metadata for a course section
    */
  const courseSectionFrontMatter = {
    uid:   helpers.addDashesToUid(pageId),
    title: helpers.replaceIrregularWhitespace(title)
  }

  if (parentUid) {
    courseSectionFrontMatter["parent_uid"] = helpers.addDashesToUid(parentUid)
  }
  if (parentTitle) {
    courseSectionFrontMatter["parent_title"] = parentTitle
  }
  if (parentType) {
    courseSectionFrontMatter["parent_type"] = parentType
  }

  if (isMediaGallery) {
    courseSectionFrontMatter["is_media_gallery"] = true
    courseSectionFrontMatter["videos"] = {
      content: videoUids,
      website: courseId
    }
  }

  if (layout) {
    courseSectionFrontMatter["layout"] = layout
  }
  if (type) {
    courseSectionFrontMatter["type"] = type
  }
  return `---\n${yaml.safeDump(courseSectionFrontMatter)}---\n`
}

const formatHTMLMarkDown = (html, courseData, pathLookup) => {
  return html
    ? `\n${helpers.unescapeBackticks(
      html2markdown(fixLinks(html || "", courseData, pathLookup, true, false))
    )}`
    : ""
}

const generateCourseSectionMarkdown = (page, courseData, pathLookup) => {
  /**
    Generate markdown a given course section page
    */
  try {
    return `${formatHTMLMarkDown(
      page["text"],
      courseData,
      pathLookup
    )}${generateCourseFeaturesMarkdown(
      page,
      courseData,
      pathLookup
    )}${formatHTMLMarkDown(page["bottomtext"], courseData, pathLookup)}`
  } catch (err) {
    loggers.fileLogger.error(err)
    return page["text"]
  }
}

const generateResourceMarkdownForFile = (file, courseData, pathLookup) => {
  /**
  Generate the front matter metadata for a PDF file
  */
  const uid = helpers.addDashesToUid(file["uid"])

  const frontMatter = {
    title:        helpers.replaceIrregularWhitespace(file["title"]),
    description:  file["description"],
    uid:          uid,
    resourcetype: helpers.getResourceType(file["file_type"]),
    file_type:    file["file_type"],
    file:         helpers.stripS3(file["file_location"]),
    type:         file["type"]
  }

  const parents = courseData["course_pages"].filter(
    coursePage => coursePage["uid"] === file["parent_uid"]
  )

  if (parents.length > 0) {
    frontMatter["parent_type"] = parents[0]["type"]
    frontMatter["parent_title"] = parents[0]["title"]
  }

  if (frontMatter.resourcetype === RESOURCE_TYPE_IMAGE) {
    const courseImageUid = helpers.getUidFromFilePath(courseData["image_src"])
    const courseImageThumbnailUid = helpers.getUidFromFilePath(
      courseData["thumbnail_image_src"]
    )
    const isCourseImage =
      courseImageThumbnailUid === uid || courseImageUid === uid
    const alt = isCourseImage
      ? courseData["image_alternate_text"]
      : file["alt_text"]
    const caption = isCourseImage
      ? courseData["image_caption_text"]
      : file["caption"]

    frontMatter["image_metadata"] = {
      ["image-alt"]: alt || "",
      caption:       html2markdown(
        fixLinks(caption || "", courseData, pathLookup, false, true)
      ),
      credit: html2markdown(
        fixLinks(file["credit"] || "", courseData, pathLookup, false, true)
      )
    }
  }

  return `---\n${yaml.safeDump(frontMatter)}---\n`
}

const generateResourceMarkdownForVideo = (media, courseData, pathLookup) => {
  const youtubeId = media["embedded_media"].find(embeddedMedia =>
    VIDEO_EMBEDDED_MEDIA_IDS.has(embeddedMedia["id"])
  )["media_location"]
  const thumbnailFile = media["embedded_media"].find(
    embeddedMedia =>
      embeddedMedia["type"] === "Thumbnail" &&
      // Sometimes the id is 'Thumbnail-YouTube-JPG_1'
      embeddedMedia["id"].startsWith("Thumbnail-YouTube-JPG")
  )
  const captionsFile = media["embedded_media"].find(
    embeddedMedia =>
      embeddedMedia["id"].endsWith(".vtt") &&
      embeddedMedia["title"] === "3play caption file"
  )
  const transcriptFile = media["embedded_media"].find(
    embeddedMedia =>
      embeddedMedia["id"].endsWith(".pdf") &&
      embeddedMedia["title"] === "3play pdf file"
  )
  const archiveRecord = media["embedded_media"].find(
    embeddedMedia => embeddedMedia["title"] === "Video-Internet Archive-MP4"
  )

  const videoThumbnailLocation = thumbnailFile
    ? thumbnailFile.media_location
    : null
  const captionsFileLocation = captionsFile
    ? helpers.stripS3(pathLookup.byUid[captionsFile.uid].fileLocation)
    : null

  const transcriptFileLocation = transcriptFile
    ? helpers.stripS3(pathLookup.byUid[transcriptFile.uid].fileLocation)
    : null

  const archiveUrl = archiveRecord ? archiveRecord.media_location : null

  const frontMatter = {
    title:          helpers.replaceIrregularWhitespace(media["title"]),
    description:    "",
    uid:            helpers.addDashesToUid(media["uid"]),
    resourcetype:   RESOURCE_TYPE_VIDEO,
    video_metadata: {
      youtube_id: youtubeId
    },
    video_files: {
      video_thumbnail_file:  videoThumbnailLocation,
      video_captions_file:   captionsFileLocation,
      video_transcript_file: transcriptFileLocation,
      archive_url:           archiveUrl
    }
  }

  const parents = courseData["course_pages"].filter(
    coursePage => coursePage["uid"] === media["parent_uid"]
  )

  if (parents.length > 0) {
    frontMatter["parent_type"] = parents[0]["type"]
    frontMatter["parent_title"] = parents[0]["title"]
  }

  const body = formatHTMLMarkDown(
    media["about_this_resource_text"],
    courseData,
    pathLookup
  )

  return `---\n${yaml.safeDump(frontMatter)}---\n${body}`
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
    courseFeaturesMarkdown = `${courseFeaturesMarkdown}\n{{< image-gallery id="${helpers.addDashesToUid(
      page["uid"]
    )}_nanogallery2" baseUrl="${helpers.stripS3(
      baseUrl
    )}" >}}\n${imageShortcodes.join("\n")}\n{{</ image-gallery >}}`
  }
  return courseFeaturesMarkdown
}

const generateCourseFeaturesMarkdown = (page, courseData) => {
  if (page.hasOwnProperty("is_image_gallery") && page["is_image_gallery"]) {
    return generateImageGalleryMarkdown(page, courseData)
  } else if (
    page.hasOwnProperty("is_media_gallery") &&
    page["is_media_gallery"]
  ) {
    return `\n\n{{< video-gallery "${helpers.addDashesToUid(
      page["uid"]
    )}" >}}\n\n`
  }
  return ""
}

const generateCourseDescription = (courseData, pathLookup) => {
  const courseDescription = courseData["description"]
    ? html2markdown(
      fixLinks(courseData["description"], courseData, pathLookup, false, true)
    )
    : ""
  const otherInformationText = courseData["other_information_text"]
    ? html2markdown(
      fixLinks(
        courseData["other_information_text"],
        courseData,
        pathLookup,
        false,
        true
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
  generateCourseSectionFrontMatter,
  generateCourseSectionMarkdown,
  generateCourseFeaturesMarkdown,
  generateCourseDescription,
  fixLinks
}
