const { assert, expect } = require("chai").use(require("sinon-chai"))
const { html2markdown } = require("./turndown")
const {
  REPLACETHISWITHAPIPE,
  AWS_REGEX,
  INPUT_COURSE_DATE_FORMAT,
  SUPPORTED_IFRAME_EMBEDS
} = require("./constants")
const markdownGenerators = require("./markdown_generators")

const singleCourseId =
  "2-00aj-exploring-sea-space-earth-fundamentals-of-engineering-design-spring-2009"

describe("turndown", () => {
  describe("tables", () => {
    let markdown
    const tableHTML = `<table summary="See table caption for summary." class="tablewidth100">
    <caption class="invisible">Course readings.</caption> <!-- BEGIN TABLE HEADER (for MIT OCW Table Template 2.51) -->
    <thead>
      <tr>
        <th scope="col">LEC&nbsp;#</th>
        <th scope="col">TOPICS</th>
        <th scope="col">READINGS&nbsp;(3D&nbsp;ED.)</th>
        <th scope="col">READINGS&nbsp;(4TH&nbsp;ED.)</th>
      </tr>
    </thead> <!-- END TABLE HEADER -->
    <tbody>
      <tr class="row">
        <td colspan="4"><strong>Control and Scope</strong></td>
      </tr>
      <tr class="alt-row">
        <td>L 1</td>
        <td>Course Overview, Introduction to Java</td>
        <td>&mdash;</td>
        <td>&mdash;</td>
      </tr>
    </tbody>
  </table>`

    beforeEach(async () => {
      markdown = await html2markdown(tableHTML)
    })

    it("should include a table definition for 4 columns", () => {
      assert.isTrue(markdown.includes("| --- | --- | --- | --- |"))
    })

    it("should properly generate a header with the fullwidth-cell shortcode", () => {
      assert.isTrue(
        markdown.includes(
          "| {{< fullwidth-cell >}}**Control and Scope**{{< /fullwidth-cell >}} | &nbsp; | &nbsp; | &nbsp; |"
        )
      )
    })
  })

  it("should not get tripped up on problematic code blocks", async () => {
    const problematicHTML =
      "<pre><span><code>stuff\nin\nthe\nblock</span></pre>"
    const markdown = await html2markdown(problematicHTML)
    assert.equal(markdown, "```\nstuff\nin\nthe\nblock\n```")
  })

  it("should properly escape square brackets inside link text", async () => {
    const problematicHTML = `<a href="syllabus">[R&amp;T]</a>`
    const markdown = await html2markdown(problematicHTML)
    assert.equal(markdown, `[\\[R&T\\]](syllabus)`)
  })

  it("should generate an anchor shortcode for an a tag with a name attribute", async () => {
    const inputHTML = `<a name="test">test</a>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, `{{< anchor "test" >}}test{{< /anchor >}}`)
  })

  it("should generate an anchor shortcode for an a tag with a name and href attribute", async () => {
    const inputHTML = `<a name="test" href="https://ocw.mit.edu">test</a>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      `{{< anchor "test" "https://ocw.mit.edu" >}}test{{< /anchor >}}`
    )
  })

  it("should turn inline code blocks into text surrounded by backticks", async () => {
    const inputHTML = `<kbd>test</kbd><tt>test</tt><samp>test</samp>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, "`test``test``test`")
  })

  it("should return a simplecast shortcode when confronted with a simplecast iframe", async () => {
    const inputHTML = `<iframe scrolling="no" seamless="" src="https://player.simplecast.com/e31edbb0-e4ac-4d9f-aebc-3d613c2f972c?dark=false" width="100%" height="200px" frameborder="no"></iframe>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      "{{< simplecast e31edbb0-e4ac-4d9f-aebc-3d613c2f972c >}}"
    )
  })

  it("should return a quote shortcode for instructor insights quotes", async () => {
    const inputHTML = `<div class="pullquote right">
      <p class="quote">I think stories are an important element of education, and if you strip them out, you don't have
        much left that can possibly be inspiring.</p>
      <p class="sig">&mdash; Patrick Winston</p>
    </div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      `{{< quote "I think stories are an important element of education, and if you strip them out, you don't have much left that can possibly be inspiring." "— Patrick Winston" >}}`
    )
  })
})
