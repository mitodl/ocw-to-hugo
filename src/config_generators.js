const yaml = require("js-yaml")

const { getExternalLinks } = require("./helpers")

const generateHugoConfig = () => {
  return yaml.safeDump({
    baseUrl:      "/",
    languageCode: "en-us",
    title:        "MIT OpenCourseWare",
    theme:        ["base-theme", "course"]
  })
}

const generateExternalLinksMenu = courseData => {
  return yaml.safeDump({
    leftnav: getExternalLinks(courseData).map((externalLink, index) => {
      return {
        name:   externalLink["title"],
        url:    externalLink["url"],
        weight: index * 10 + 1000
      }
    })
  })
}

module.exports = {
  generateHugoConfig,
  generateExternalLinksMenu
}
