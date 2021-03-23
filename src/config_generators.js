const { getExternalLinks } = require("./helpers")

const generateExternalLinksMenu = courseData => {
  let weight = 1000
  return `${getExternalLinks(courseData).map(externalLink => {
    weight += 10
    return `[[leftnav]]\n\tname = "${externalLink["title"]}"\n\turl = "${externalLink["url"]}"\n\tweight = ${weight}`
  })}`
}

module.exports = {
  generateExternalLinksMenu
}
