const { getExternalLinks } = require("./helpers")

const generateExternalLinksMenu = courseData => {
  return `${getExternalLinks(courseData).map((externalLink, index) => {
    return `[[leftnav]]\n\tname = "${externalLink["title"]}"\n\turl = "${
      externalLink["url"]
    }"\n\tweight = ${index * 10 + 1000}`
  })}`
}

module.exports = {
  generateExternalLinksMenu
}
