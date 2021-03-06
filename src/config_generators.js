const yaml = require("js-yaml")

const { getInternalMenuItems, getExternalMenuItems } = require("./helpers")

const generateMenuItems = (courseData, pathLookup) => {
  const internalMenuItems = getInternalMenuItems(courseData, pathLookup)
  const externalMenuItems = getExternalMenuItems(courseData).map(
    (externalLink, index) => ({
      name:   externalLink["title"],
      url:    externalLink["url"],
      weight: index * 10 + 1000
    })
  )
  return yaml.safeDump({
    leftnav: internalMenuItems.concat(externalMenuItems)
  })
}

module.exports = {
  generateMenuItems
}
