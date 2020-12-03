const { runOptions } = require("./helpers")

// module for declaring key filepaths in one place
const MARKDOWN_PATH = path.join(
  runOptions.output,
  "content",
  "courses"
)

const DATA_TEMPLATE_DIR = path.join(
  runOptions.output,
  "data",
  "courses"
)
