const fs = require("fs")
const path = require("path")
const tar = require("tar")

const isDirectory = pathname => fs.statSync(pathname).isDirectory()

// returns an array of all files and directories within a directory
const directoryTree = pathname =>
  fs.readdirSync(pathname).reduce((acc, child) => {
    const childPathname = path.join(pathname, child)

    return isDirectory(childPathname)
      ? acc.concat(childPathname, directoryTree(childPathname))
      : acc.concat(childPathname)
  }, [])

// scan all files and directories in a path to get the most recent modified time
const lastModifiedDate = pathname =>
  directoryTree(pathname)
    .map(pathname => fs.statSync(pathname).mtime)
    .reduce((latest, current) => (latest < current ? current : latest))

const ensureCacheDir = () => {
  if (!fs.existsSync(".cache")) {
    fs.mkdirSync(".cache")
  }
}

const cacheCourseContent = (markdownPath, courseKey, cacheName) => {
  ensureCacheDir()

  tar.c(
    {
      gzip: true,
      C: markdownPath
    },
    [ courseKey ]
  ).pipe(fs.createWriteStream(
    `.cache/${courseKey}_markdown.tgz`
  ))
}

const cacheCourseData = (dataTemplatePath, courseKey) => {
  fs.copyFileSync(
    dataTemplatePath,
    `.cache/${courseKey}.json`
  )
}

module.exports = { cacheCourseContent, cacheCourseData } 
