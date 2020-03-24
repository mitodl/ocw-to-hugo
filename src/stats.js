#!/usr/bin/env node
/* eslint-disable no-console */

const _stats = {}
const _descriptions = {}

const init = () => {
  create("longest-course-title", "Longest course title", 0)
  create("shortest-course-title", "Shortest course title", 0)
  create("longest-section-title", "Longest section title", 0)
  create("shortest-section-title", "Shortest section title", 0)
  create("longest-pdf-title", "Longest PDF title", 0)
  create("shortest-pdf-title", "Shortest PDF title", 0)
}

const create = (key, description, initalValue) => {
  _stats[key] = initalValue
  _descriptions[key] = description
}

const get = key => {
  return _stats[key]
}

const set = (key, value) => {
  _stats[key] = value
}

const print = () => {
  console.log(
    Object.keys(_stats).map(key => {
      return `${_descriptions[key]}: ${_stats[key]}`
    })
  )
}

module.exports = {
  init,
  create,
  get,
  set,
  print
}
