const OriginalTurndownService = require("turndown")
const turndownPluginGfm = require("turndown-plugin-gfm")
const { gfm, tables } = turndownPluginGfm

const {
  REPLACETHISWITHAPIPE,
  AWS_REGEX,
  SUPPORTED_IFRAME_EMBEDS,
  EMBEDDED_RESOURCE_SHORTCODE_PLACEHOLDER_CLASS,
  IRREGULAR_WHITESPACE_REGEX,
  BASEURL_PLACEHOLDER_REGEX,
  DIV_WITH_CLASS_CLASSES_REGEXES,
  RESOURCE_FILE_PLACEHOLDER
} = require("./constants")
const helpers = require("./helpers")
const loggers = require("./loggers")

class TurndownService extends OriginalTurndownService {
  /**
   * By default, turndown escapes Markdown characters in HTML input. See
   * https://github.com/mixmark-io/turndown#escaping-markdown-characters
   *
   * That's good. But it does NOT (usually) escape angle brackets in the output,
   * e.g. "&lt;a dog&gt;"" turns into "<a dog>", which can be erroneously
   * interpretted as an anchor tag. [Aside: Turndown does escape angle brackets
   * at the beginning of a line, since those are markdown block quotes.]
   *
   * Below, we monkey-patch the escape method to escape OPENING angle-brackets
   * only, unless they are already escaped. Why only opening?
   *  - According to the GFM spec (https://github.github.com/gfm/#backslash-escapes)
   *    escaping opening and closing brackets should be safe
   *  - But showdown, which we use in OCW Studio, renders "\>" as "\>" instead
   *    of ">".
   * So don't escape the closing brackets.
   *
   * NOTE: This escaping needs to happen *after* turndown's default escaping,
   * else turndown will escape the backslashes, too!
   */
  escape(string) {
    /**
     * Regex to match
     *  1) an even number of backslashes,
     *  2) not preceeded or followed by a backslash
     *  3) followed by <
     *
     * (2) precludes from erroneously matching an odd number of backslashes.
     */
    const UNESCAPED_OPENING_ANGLE_BRACKET = /(?<!\\)(?:\\\\)*(?!\\)</g
    return super
      .escape(string)
      .replace(UNESCAPED_OPENING_ANGLE_BRACKET, match => `\\${match}`)
  }
}

const turndownService = new TurndownService({
  codeBlockStyle: "fenced"
})
turndownService.use(gfm)

turndownService.addRule("table", {
  filter:      node => node.nodeName === "TABLE",
  replacement: (content, node, options) => {
    return `{{< tableopen >}}\n${content}\n{{< tableclose >}}\n`
  }
})

turndownService.addRule("caption", {
  filter: node =>
    hasParentNodeRecursive(node, "TABLE") && node.nodeName === "CAPTION",
  replacement: (content, node, options) => {
    // TODO: implement actual handling of table captions
    return ""
  }
})

turndownService.addRule("th", {
  filter:      node => node.nodeName === "TH",
  replacement: (content, node, options) => {
    const colspan = node.getAttribute("colspan")
      ? ` colspan="${node.getAttribute("colspan")}"`
      : ""
    const rowspan = node.getAttribute("rowspan")
      ? ` rowspan="${node.getAttribute("rowspan")}"`
      : ""
    return `{{< thopen${colspan}${rowspan} >}}\n${content}\n{{< thclose >}}\n`
  }
})

turndownService.addRule("tr", {
  filter:      node => node.nodeName === "TR",
  replacement: (content, node, options) => {
    return `{{< tropen >}}\n${content}\n{{< trclose >}}\n`
  }
})

turndownService.addRule("td", {
  filter:      node => node.nodeName === "TD",
  replacement: (content, node, options) => {
    const colspan = node.getAttribute("colspan")
      ? ` colspan="${node.getAttribute("colspan")}"`
      : ""
    const rowspan = node.getAttribute("rowspan")
      ? ` rowspan="${node.getAttribute("rowspan")}"`
      : ""
    return `{{< tdopen${colspan}${rowspan} >}}\n${content}\n{{< tdclose >}}\n`
  }
})

turndownService.addRule("thead", {
  filter:      node => node.nodeName === "THEAD",
  replacement: (content, node, options) => {
    return `{{< theadopen >}}\n${content}\n{{< theadclose >}}\n`
  }
})

turndownService.addRule("tfoot", {
  filter:      node => node.nodeName === "TFOOT",
  replacement: (content, node, options) => {
    return `{{< tfootopen >}}\n${content}\n{{< tfootclose >}}\n`
  }
})

/**
 * fix some strangely formatted code blocks in OCW
 * see https://github.com/mitodl/hugo-course-publisher/issues/154
 * for discussion
 * also turns <pre> elements into code blocks
 */

turndownService.addRule("codeblockfix", {
  filter:      node => node.nodeName === "PRE",
  replacement: (content, node, options) => {
    if (node.firstChild && node.firstChild.nodeName === "SPAN") {
      if (content.match(/\r?\n/)) {
        return `\n\n\`\`\`\n${content.replace(/`/g, "")}\n\`\`\`\n\n`
      }
      return content
    }
    // if string starts with a 'tab' then it is converted into a code block while MD to HTML
    // so no need to make it a code block here
    if (content.startsWith("\t") || content.startsWith("    ")) {
      return content
    }
    return `\n\n\`\`\`\n${helpers.removeLeadingBackslash(content)}\n\`\`\`\n\n`
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
 * In legacy course, 1 liner code snippets are <span> elements having a particular inline style
 * For details, see https://github.com/mitodl/ocw-to-hugo/issues/464
 */
turndownService.addRule("one_line_code", {
  filter: node =>
    node.nodeName === "SPAN" &&
    node.getAttribute("style") === "font-family: Courier New,Courier;",
  replacement: (content, node, options) => {
    return `\`${content}\`\n`
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
      if (node.getAttribute("href").match(BASEURL_PLACEHOLDER_REGEX)) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    return `[${content}](${node
      .getAttribute("href")
      .replace(BASEURL_PLACEHOLDER_REGEX, "{{< baseurl >}}")})`
  }
})

turndownService.addRule("resourcefileshortcode", {
  filter: (node, options) => {
    if (node.nodeName === "A" && node.getAttribute("href")) {
      if (node.getAttribute("href").match(RESOURCE_FILE_PLACEHOLDER)) {
        return true
      }
    } else if (node.nodeName === "IMG" && node.getAttribute("src")) {
      if (node.getAttribute("src").match(RESOURCE_FILE_PLACEHOLDER)) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    if (node.nodeName === "A") {
      const parts = node.getAttribute("href").split(" ")
      const resourceUrl = parts[2]
      return `[${content}]({{< baseurl >}}${resourceUrl})`
    } else if (node.nodeName === "IMG") {
      const altText = node.getAttribute("alt") ? node.getAttribute("alt") : ""
      const parts = node.getAttribute("src").split(" ")
      const uid = parts[1]
      return `![${altText}]({{< resource_file ${uid} >}})`
    }
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
 * Remove Classroom section
 **/
turndownService.addRule("remove_the_classroom", {
  filter: (node, options) => {
    if (node.nodeName !== "DIV") return false
    const children = Array.from(node.childNodes)
    return children.some(node => {
      return node.nodeName === "A" && node.getAttribute("name") === "classroom"
    })
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

turndownService.addRule("div_with_class", {
  filter: (node, options) => {
    if (node.nodeName === "DIV" && node.getAttribute("class")) {
      for (const classRegex of DIV_WITH_CLASS_CLASSES_REGEXES) {
        if (classRegex.test(node.getAttribute("class"))) {
          return true
        }
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    const name = JSON.stringify(node.getAttribute("class"))
    return `{{< div-with-class ${name}>}}${content}{{< /div-with-class >}}`
  }
})

turndownService.addRule("multiple_choice_question", {
  filter: (node, options) => {
    if (node.nodeName === "DIV" && node.getAttribute("class")) {
      if (
        node.getAttribute("class") === "problem_question" &&
        node.getElementsByClassName("problem_radio_input")
      ) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    const questionId = node.getAttribute("id")
    let questionMarkdown = Array.from(
      node.getElementsByTagName("fieldset")[0].childNodes
    )
      .filter(child => {
        if (
          child.nodeName === "DIV" &&
          child.getAttribute("class").includes("choice") &&
          child.getElementsByClassName("problem_radio_input")
        ) {
          return true
        }
      })
      .map(choice => {
        const isCorrect =
          choice
            .getElementsByClassName("problem_radio_input")[0]
            .getAttribute("correct") === "true"
        return `{{< quiz_choice isCorrect="${isCorrect}" >}}${turndownService.turndown(
          choice.outerHTML
        )}{{< /quiz_choice >}}`
      })
      .join("\n")
    questionMarkdown = `{{< quiz_choices >}}${questionMarkdown}{{< /quiz_choices >}}`
    const solution = helpers.getNextSibling(node, "div.problem_solution")

    let solutionMarkdown = `{{< quiz_solution / >}}`

    if (solution) {
      solutionMarkdown = `{{< quiz_solution >}}${turndownService.turndown(
        solution.outerHTML
      )}{{< /quiz_solution >}}`
    }

    questionMarkdown = `${questionMarkdown}\n${solutionMarkdown}`

    return `{{< quiz_multiple_choice questionId="${questionId}" >}}${questionMarkdown}{{< /quiz_multiple_choice >}}`
  }
})

turndownService.addRule("multiple_choice_questions_widget", {
  filter: (node, options) => {
    if (node.nodeName === "SCRIPT" && node.textContent.includes("quizMulti")) {
      return true
    }
    return false
  },
  replacement: (content, node, options) => {
    const jsParser = require("acorn")
    const walk = require("acorn-walk")
    const nodeText = node.textContent.replace(
      "// There was an extra comma at the end of multiList array.",
      ""
    )

    const quizData = jsParser.parse(nodeText, { ecmaVersion: 11 })

    const dataNode = walk.findNodeAt(quizData, null, null, function(
      type,
      node
    ) {
      return (
        type === "VariableDeclarator" && node.id && node.id.name === "quizMulti"
      )
    })

    let dataSubstring = String(
      nodeText.substring(dataNode.node.init.start, dataNode.node.init.end)
    )

    for (const key of ["multiList", "ques", "ans", "ansSel", "ansInfo"]) {
      dataSubstring = dataSubstring.replace(RegExp(`${key}:`, "g"), `"${key}":`)
    }

    const data = JSON.parse(dataSubstring)
    let markdown = ""
    data["multiList"].forEach((question, index) => {
      markdown = markdown.concat(
        "\n",
        turndownService.turndown(`<h4>Question ${index + 1}</h4>`),
        "\n"
      )
      markdown = markdown.concat(
        " ",
        `{{< quiz_multiple_choice questionId="MCQ${index + 1}" >}}`
      )

      markdown = markdown.concat(" ", question["ques"])

      markdown = markdown.concat(" ", `{{< quiz_choices >}}`)

      const options = question["ansSel"]
      options.push(question["ans"])
      options.sort()

      for (const option of options) {
        markdown = markdown.concat(
          " ",
          `{{< quiz_choice isCorrect="${option ===
            question["ans"]}" >}}${option}{{< /quiz_choice >}}`
        )
      }

      markdown = markdown.concat(" ", `{{< /quiz_choices >}}`)

      if (question["ansInfo"]) {
        markdown = markdown.concat(
          " ",
          `{{< quiz_solution >}}${question["ansInfo"]}{{< /quiz_solution >}}`
        )
      } else {
        markdown = markdown.concat(" ", "{{< quiz_solution / >}}")
      }

      markdown = markdown.concat(" ", `{{< /quiz_multiple_choice >}}`)
    })

    return markdown
  }
})

turndownService.addRule("question_action", {
  filter: (node, options) => {
    if (node.nodeName === "DIV" && node.getAttribute("class")) {
      if (
        node.getAttribute("class") === "action" &&
        helpers.getPreviousSibling(node, "div.problem_question")
      ) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    return ""
  }
})

turndownService.addRule("question_solution", {
  filter: (node, options) => {
    if (node.nodeName === "DIV" && node.getAttribute("class")) {
      if (
        node.getAttribute("class") === "problem_solution" &&
        helpers.getPreviousSibling(node, "div.problem_question")
      ) {
        return true
      }
    }
    return false
  },
  replacement: (content, node, options) => {
    return ""
  }
})

turndownService.addRule("resource_shortcodes", {
  filter: (node, options) => {
    const nodeClass = node.getAttribute("class")
    return (
      node.nodeName === "DIV" &&
      nodeClass === EMBEDDED_RESOURCE_SHORTCODE_PLACEHOLDER_CLASS
    )
  },
  replacement: (content, node, options) => {
    const mediaUid = node.textContent
    return `{{< resource ${mediaUid} >}}`
  }
})

turndownService.addRule("subscript", {
  filter: (node, options) => {
    return node.nodeName === "SUB"
  },
  replacement: (content, node, options) => {
    const quotesEscaped = JSON.stringify(content)
    return `{{< sub ${quotesEscaped} >}}`
  }
})

turndownService.addRule("superscript", {
  filter: (node, options) => {
    return node.nodeName === "SUP"
  },
  replacement: (content, node, options) => {
    const quotesEscaped = JSON.stringify(content)
    return `{{< sup ${quotesEscaped} >}}`
  }
})

function html2markdown(text) {
  return turndownService.turndown(text)
}

function hasParentNodeRecursive(node, parentNodeName) {
  if (node.parentNode) {
    if (node.parentNode.nodeName === parentNodeName) {
      return true
    } else return hasParentNodeRecursive(node.parentNode, parentNodeName)
  } else return false
}

module.exports = { html2markdown }
