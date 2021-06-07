const yaml = require("js-yaml")

const { getExternalLinks } = require("./helpers")

const generateExternalLinksMenu = courseData =>
  yaml.safeDump({
    leftnav: getExternalLinks(courseData).map((externalLink, index) => ({
      name:   externalLink["title"],
      url:    externalLink["url"],
      weight: index * 10 + 1000
    }))
  })

module.exports = {
  generateExternalLinksMenu
}
