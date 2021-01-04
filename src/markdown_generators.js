const path = require("path")
const yaml = require("js-yaml")
const markdown = require("markdown-doc-builder").default
const TurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const stripHtml = require("string-strip-html")

const {
  REPLACETHISWITHAPIPE,
  GETPAGESHORTCODESTART,
  GETPAGESHORTCODEEND,
  AWS_REGEX,
  SUPPORTED_IFRAME_EMBEDS
} = require("./constants")
const helpers = require("./helpers")
const loggers = require("./loggers")
const { html2markdown } = require("./turndown")

const fixLinks = (htmlStr, page, courseData, courseUidsLookup) => {
  if (htmlStr && page) {
    htmlStr = helpers.resolveUids(htmlStr, page, courseData, courseUidsLookup)
    htmlStr = helpers.resolveRelativeLinks(htmlStr, courseData)
    htmlStr = helpers.resolveYouTubeEmbed(htmlStr, courseData)
  }
  return htmlStr
}

const generateMarkdownFromJson = (courseData, courseUidsLookup) => {
  /**
    This function takes JSON data parsed from a parsed.json file and returns markdown data
    */
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
      data: generateCourseHomeMarkdown(courseData, courseUidsLookup)
    },
    ...rootSections.map(
      page => generateMarkdownRecursive(page, courseUidsLookup, courseData),
      this
    )
  ]
}

const generateMarkdownRecursive = (page, courseUidsLookup, courseData) => {
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
  const inRootNav = page["parent_uid"] === courseData["uid"]
  let courseSectionMarkdown = generateCourseSectionFrontMatter(
    page["title"],
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
    courseUidsLookup
  )
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
    children: children.map(
      page => generateMarkdownRecursive(page, courseUidsLookup, courseData),
      this
    ),
    files: pdfFiles
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

const generateCourseHomeMarkdown = (courseData, courseUidsLookup) => {
  /**
    Generate the front matter metadata for the course home page given course_data JSON
    */
  const courseHomePage = courseData["course_pages"].find(
    coursePage => coursePage["type"] === "CourseHomeSection"
  )
  const courseDescription = courseData["description"]
    ? html2markdown(
      fixLinks(
        courseData["description"],
        courseHomePage,
        courseData,
        courseUidsLookup
      )
    )
    : ""
  const otherInformationText = courseData["other_information_text"]
    ? html2markdown(
      fixLinks(
        courseData["other_information_text"],
        courseHomePage,
        courseData,
        courseUidsLookup
      )
    )
    : ""

  const pageId = courseHomePage ? courseHomePage["uid"] : "course-home"
  const frontMatter = {
    uid:       pageId,
    title:     "",
    type:      "course",
    layout:    "course_home",
    course_id: courseData["short_url"],
    menu:      {
      [courseData["short_url"]]: {
        identifier: pageId,
        weight:     -10
      }
    }
  }
  try {
    return `---\n${yaml.safeDump(
      frontMatter
    )}---\n${courseDescription}\n${otherInformationText}`
  } catch (err) {
    loggers.fileLogger.error(err)
    return null
  }
}

const generateCourseSectionFrontMatter = (
  title,
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
    layout:    "course_section"
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

const generateCourseFeatures = courseData => {
  /**
    Generate markdown for the "Course Features" section of the home page
    */
  const courseFeaturesHeader = markdown
    .newBuilder()
    .h5("Course Features")
    .toMarkdown()

  const courseFeatures = courseData["course_features"]
    .map(courseFeature => {
      const section = helpers.getCourseSectionFromFeatureUrl(courseFeature)
      const matchingSections = courseData["course_pages"].filter(
        coursePage => coursePage["short_url"] === section
      )
      if (section && matchingSections.length > 0) {
        return markdown
          .newBuilder()
          .link(
            `{{% ref "${helpers.pathToChildRecursive(
              path.join("courses", courseData["short_url"], "sections"),
              matchingSections[0],
              courseData
            )}" %}}`,
            courseFeature["ocw_feature"]
          )
          .toMarkdown()
      } else return null
    })
    .filter(courseFeature => courseFeature)
  return `${courseFeaturesHeader}\n${markdown
    .newBuilder()
    .list(courseFeatures)
    .toMarkdown()}`
}

const formatHTMLMarkDown = (page, courseData, courseUidsLookup, section) => {
  return page[section]
    ? `\n${helpers.unescapeBackticks(
      html2markdown(
        fixLinks(page[section] || "", page, courseData, courseUidsLookup)
      )
    )}`
    : ""
}

const generateCourseSectionMarkdown = (page, courseData, courseUidsLookup) => {
  /**
    Generate markdown a given course section page
    */
  try {
    return `${formatHTMLMarkDown(
      page,
      courseData,
      courseUidsLookup,
      "text"
    )}${generateCourseFeaturesMarkdown(page, courseData)}${formatHTMLMarkDown(
      page,
      courseData,
      courseUidsLookup,
      "bottomtext"
    )}`
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

const generateVideoGalleryMarkdown = (page, courseData) => {
  let courseFeaturesMarkdown = ""
  const videos = Object.values(courseData["course_embedded_media"]).filter(
    obj => obj["parent_uid"] === page["uid"]
  )
  if (videos.length > 0) {
    const videoDivs = []
    videos.forEach(video => {
      const videoArgs = {
        href: helpers.pathToChildRecursive(
          `/courses/${courseData.short_url}/sections`,
          video,
          courseData
        ),
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
      video.embedded_media.forEach(media => {
        if (media.type === "Thumbnail" && media.media_location) {
          videoArgs.thumbnail = media.media_location
        }
      })
      videoDivs.push(
        `{{< video-gallery-item ${Object.keys(videoArgs)
          .map(key => `${key}="${videoArgs[key]}"`)
          .join(" ")} >}}`
      )
    })
    courseFeaturesMarkdown = videoDivs.join("\n")
  }
  return courseFeaturesMarkdown
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

const generateCourseFeaturesMarkdown = (page, courseData) => {
  if (page.hasOwnProperty("is_image_gallery") && page["is_image_gallery"]) {
    return generateImageGalleryMarkdown(page, courseData)
  } else if (
    page.hasOwnProperty("is_media_gallery") &&
    page["is_media_gallery"]
  ) {
    return generateVideoGalleryMarkdown(page, courseData)
  }
  return ""
}

module.exports = {
  generateMarkdownFromJson,
  generateCourseHomeMarkdown,
  generateCourseSectionFrontMatter,
  generateCourseFeatures,
  generateCourseSectionMarkdown,
  generateCourseFeaturesMarkdown
}
