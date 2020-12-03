const fsPromises = require("./fsPromises")
const fs = require("fs")
const path = require("path")

const directoryExists = async directory => {
  try {
    return (await fsPromises.lstat(directory)).isDirectory()
  } catch (err) {
    // this will happen if we don't have access to the directory or if it doesn't exist
    return false
  }
}

const fileExists = async path => {
  try {
    return (await fsPromises.lstat(path)).isFile()
  } catch (err) {
    // this will happen if we don't have access to the file or if it doesn't exist
    return false
  }
}

const ensureDirnameExists = async (filePath) => {
  const dirName = path.dirname(filePath)
  await fsPromises.mkdir(dirName, { recursive: true })
}


const createOrOverwriteFile = async (filePath, body) => {
  await ensureDirnameExists(filePath)
  await fsPromises.writeFile(filePath, body)
}

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

module.exports = {
  directoryExists,
  fileExists,
  createOrOverwriteFile,
  ensureDirnameExists,
  isDirectory,
  directoryTree,
  lastModifiedDate
}
