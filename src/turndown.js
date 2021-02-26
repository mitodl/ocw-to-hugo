const TurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const { gfm, tables } = turndownPluginGfm

const {
  REPLACETHISWITHAPIPE,
  AWS_REGEX,
  BASEURL_SHORTCODE,
  SUPPORTED_IFRAME_EMBEDS,
  YOUTUBE_SHORTCODE_PLACEHOLDER_CLASS
} = require("./constants")
const helpers = require("./helpers")
const loggers = require("./loggers")

const turndownService = new TurndownService({
  codeBlockStyle: "fenced"
})
turndownService.use(gfm)
turndownService.use(tables)

/**
 * Sanitize markdown table content
 **/
turndownService.addRule("table", {
  filter:      ["table"],
  replacement: (content, node, options) => {
    /**
     * Iterate the HTML node and replace all pipes inside table
     * cells with a marker we'll use later
     */
    for (let i = 0; i < node.rows.length; i++) {
      const cells = node.rows[i].cells
      for (let j = 0; j < cells.length; j++) {
        cells[j].innerHTML = cells[j].innerHTML.replace(
          /\|/g,
          REPLACETHISWITHAPIPE
        )
      }
    }
    // Regenerate markdown for this table with cell edits
    content = turndownService.turndown(node)
    content = content
      // First, isolate the table by getting the contents between the first and last pipe
      .substring(content.indexOf("|"), content.lastIndexOf("|"))
      // Second, replace all newlines and carriage returns with line break shortcodes
      .replace(/\r?\n|\r/g, "{{< br >}}")
      /**
       * Third, replace all line break shortcodes in between two pipes with a newline
       * character between two pipes to recreate the rows
       */
      .replace(/\|{{< br >}}\|/g, "|\n|")
      // Fourth, replace the pipe marker we added earlier with the HTML character entity for a pipe
      .replace(/REPLACETHISWITHAPIPE/g, "&#124;")
    /**
     * This finds table header rows by matching a cell with only one bold string.
     * Regex breakdown by capturing group:
     * 1. Positive lookbehind that finds a pipe followed by a space and two asterisks
     * 2. Matches any amount of alphanumeric characters
     * 3. Positive lookahead that matches two asterisks followed by a space, a pipe and
     * a newline or carriage return
     */
    if (content.match(/(?<=\| \*\*)(.*?)(?=\*\* \|\r?\n|\r)/g)) {
      // Get the amount of columns by matching three hyphens and counting
      const totalColumns = content.match(/---/g || []).length
      // Style headers so that they aren't bound by the width of one cell
      content.match(/\| \*\*(.*)\*\* \|\r?\n|\r/g).forEach(element => {
        const headerContent = element
          .replace(/\| \*\*/g, "")
          .replace(/\*\* \|\r?\n|\r/g, "")
        // Wrap header content in the fullwidth-cell shortcode and insert spaces to set line height
        content = content.replace(
          element,
          `| {{< fullwidth-cell >}}**${headerContent}**{{< /fullwidth-cell >}} |${" &nbsp; |".repeat(
            totalColumns - 1
          )}\n`
        )
      })
      return content
    } else return content
  }
})

/**
 * fix some strangely formatted code blocks in OCW
 * see https://github.com/mitodl/hugo-course-publisher/issues/154
 * for discussion
 */
turndownService.addRule("codeblockfix", {
  filter: node =>
    node.nodeName === "PRE" &&
    node.firstChild &&
    node.firstChild.nodeName === "SPAN",
  replacement: (content, node, options) => {
    if (content.match(/\r?\n/)) {
      return `\n\n\`\`\`\n${content.replace(/`/g, "")}\n\`\`\`\n\n`
    } else {
      return content
    }
  }
})

/**
 * turn kbd, tt and samp elements into inline code blocks
 */
turndownService.addRule("inlinecodeblockfix", {
  filter: node =>
    node.nodeName === "KBD" ||
    node.nodeName === "TT" ||
    node.nodeName === "SAMP",
  replacement: (content, node, options) => {
    /**
     * fix weird formatting issue with some elements' content being wrapped
     * between a backtick and a single quote
     */
    try {
      // eslint seems to think the escaped backtick in the regex is useless, but it's not
      // eslint-disable-next-line no-useless-escape
      const backTickSingleQuoteWrap = new RegExp(/(?<=\`)(.*?)(?=')/g)
      const matches = content.match(backTickSingleQuoteWrap)
      if (matches) {
        for (const match of matches) {
          content = content.replace(`\\\`${match}'`, match)
        }
      }
    } catch (err) {
      loggers.fileLogger.error(err)
    }
    return `\`${content}\``
  }
})

/**
 * Build anchor link shortcodes
 **/
turndownService.addRule("anchorshortcode", {
  filter: (node, options) => {
    if (node.nodeName === "A" && node.getAttribute("name")) {
      return true
    }
    return false
  },
  replacement: (content, node, options) => {
    const name = node.getAttribute("name")
    const href = node.getAttribute("href")
    return `{{< anchor "${name}"${
      href ? ` "${href}"` : ""
    } >}}${content}{{< /anchor >}}`
  }
})

/**
 * Strip open-learning-course-data*.s3.amazonaws.com urls back to being absolute urls
 */
if (helpers.runOptions.stripS3) {
  turndownService.addRule("stripS3", {
    filter: (node, options) => {
      if (node.nodeName === "A" && node.getAttribute("href")) {
        if (node.getAttribute("href").match(AWS_REGEX)) {
          return true
        }
      } else if (node.nodeName === "IMG" && node.getAttribute("src")) {
        if (node.getAttribute("src").match(AWS_REGEX)) {
          return true
        }
      }
      return false
    },
    replacement: (content, node, options) => {
      const attr = node.nodeName === "A" ? "href" : "src"
      const alt = node.getAttribute("alt")
      const isImage = node.nodeName === "IMG"
      return `${isImage ? "!" : ""}[${
        isImage ? alt : content
      }](${helpers.stripS3(node.getAttribute(attr))})`
    }
  })
}

// add support for embedded content from various sources
turndownService.addRule("iframe", {
  filter: (node, options) => {
    if (node.nodeName === "IFRAME") {
      const src = node.getAttribute("src")

      if (src) {
        const url = new URL(src)
        return SUPPORTED_IFRAME_EMBEDS.hasOwnProperty(url.hostname)
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    const src = new URL(node.getAttribute("src"))
    const { hugoShortcode, getID } = SUPPORTED_IFRAME_EMBEDS[src.hostname]

    return `{{< ${hugoShortcode} ${getID(src)} >}}`
  }
})

/**
 * Build quote element shortcodes for instructor insights sections
 **/
turndownService.addRule("quoteshortcode", {
  filter: (node, options) => {
    if (node.nodeName === "DIV" && node.getAttribute("class")) {
      if (node.getAttribute("class").includes("pullquote")) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    try {
      const children = Array.from(node.childNodes)
      const quoteP = children.find(
        child =>
          child.nodeName === "P" && child.getAttribute("class") === "quote"
      )
      const sigP = children.find(
        child => child.nodeName === "P" && child.getAttribute("class") === "sig"
      )
      const quote = helpers.escapeDoubleQuotes(quoteP.textContent)
      const sig = helpers.escapeDoubleQuotes(sigP.textContent)
      return `{{< quote "${quote}" "${sig}" >}}`
    } catch (err) {
      loggers.fileLogger.error(err)
    }
  }
})

turndownService.addRule("baseurlshortcode", {
  filter: (node, options) => {
    if (node.nodeName === "A" && node.getAttribute("href")) {
      if (node.getAttribute("href").includes(BASEURL_SHORTCODE)) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    const children = Array.from(node.childNodes)
    if (!children.filter(child => child.nodeName === "IMG").length > 0) {
      // if this link doesn't contain an image, escape the content
      // except first make sure there are no pre-escaped square brackets
      content = turndownService.escape(
        content.replace(/\\\[/g, "[").replace(/\\\]/g, "]")
      )
    }
    const ref = turndownService
      .escape(
        node.getAttribute("href").replace(BASEURL_SHORTCODE, "{{< baseurl >}}")
      )
      .split("\\_")
      .join("_")
    return `[${content}](${ref})`
  }
})

/**
 * Remove pie charts with the surrounding div of class edu_grading
 **/
turndownService.addRule("edu_grading", {
  filter: (node, options) => {
    if (node.nodeName === "DIV" && node.getAttribute("class")) {
      if (node.getAttribute("class").includes("edu_grading")) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    // filter out the pie chart and legend, converting the rest to markdown
    return Array.from(node.childNodes)
      .filter(child => {
        if (
          !(
            child.nodeName === "DIV" &&
            child.childNodes[0].nodeName === "CANVAS"
          )
        ) {
          return true
        }
      })
      .map(child => {
        if (
          child.nodeName === "DIV" &&
          child.getAttribute("class") === "edu_breakdown_key"
        ) {
          return `${Array.from(child.childNodes)
            .map(keyItem => {
              return `- ${keyItem.textContent.trim()}`
            })
            .join("\n")}\n`
        } else return turndownService.turndown(child.outerHTML)
      })
      .join("\n")
  }
})

/**
 * Remove pie charts with the surrounding div of class edu_hours_left
 **/
turndownService.addRule("edu_hours_left", {
  filter: (node, options) => {
    if (node.nodeName === "DIV" && node.getAttribute("class")) {
      if (node.getAttribute("class").includes("edu_hours_left")) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    return ""
  }
})

/**
 * Remove semester breakdown chart
 **/
turndownService.addRule("edu_breakdown", {
  filter: (node, options) => {
    if (node.nodeName === "DIV") {
      const children = Array.from(node.childNodes)
      const header = children.find(child => child.nodeName === "H2")
      const chart = children.find(
        child =>
          child.nodeName === "TABLE" &&
          child.getAttribute("class") === "edu_breakdown"
      )
      const key = children.find(
        child =>
          child.nodeName === "DIV" &&
          child.getAttribute("class") === "edu_breakdown_key"
      )
      if (header && chart && key) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    return ""
  }
})

/**
 * Catch "approx" images and render as HTML instead
 */
turndownService.addRule("approx_img", {
  filter: (node, options) => {
    if (
      node.nodeName === "IMG" &&
      node.getAttribute("src").includes("-approx.png")
    ) {
      return true
    }
    return false
  },
  replacement: (content, node, options) => {
    const match =
      node.getAttribute("src").match(/(\/|_)(?<amount>[0-9]+)-approx.png/) || []
    if (match) {
      const amount = match.groups.amount
      return `{{< approx-students ${amount} >}}`
    }
  }
})

/**
 * Render h4 tags as an h5 instead
 */
turndownService.addRule("h4", {
  filter:      ["h4"],
  replacement: (content, node, options) => {
    return `##### ${content}`
  }
})

turndownService.addRule("youtube_shortcodes", {
  filter: (node, options) => {
    const nodeClass = node.getAttribute("class")
    return (
      node.nodeName === "DIV" &&
      nodeClass === YOUTUBE_SHORTCODE_PLACEHOLDER_CLASS
    )
  },
  replacement: (content, node, options) => {
    const mediaLocation = node.textContent
    return `{{< youtube ${mediaLocation} >}}`
  }
})

function html2markdown(text) {
  return turndownService.turndown(text)
}

module.exports = { html2markdown }
