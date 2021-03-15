const { assert } = require("chai").use(require("sinon-chai"))
const { html2markdown } = require("./turndown")
const { YOUTUBE_SHORTCODE_PLACEHOLDER_CLASS } = require("./constants")

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
      <tr class="row">
        <td colspan="4"><p><strong>Wrapped in a paragraph</strong></p></td>
      </tr>
      <tr class="alt-row">
        <td>L 2</td>
        <td>Test table section 2</td>
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

    it("should properly generate a header with the td-colspan shortcode", () => {
      assert.isTrue(
        markdown.includes(
          "| {{< td-colspan 4 >}}**Control and Scope**{{< /td-colspan >}} ||||"
        )
      )
    })

    it("should handle headers properly if they're wrapped in a p tag", () => {
      assert.isTrue(
        markdown.includes(
          "| {{< td-colspan 4 >}}{{< br >}}{{< br >}}**Wrapped in a paragraph**{{< br >}}{{< br >}}{{< /td-colspan >}} ||||"
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

  it("should remove pie charts surrounded in a div with the class edu_grading without removing unrelated content", async () => {
    const inputHTML = `<div class="onehalf alpha">
      <p>TOP TEXT</p>
      <div class="edu_grading" style="clear: both; position: relative;">
        <div><canvas width="175" height="175" id="canvas5" style="width: 175px; height: 175px;"></canvas>
          <script>
            PIE CHART SCRIPT
          </script>
        </div>
        <div class="edu_breakdown_key" style="float: right; width: 185px; margin-top: -180px;">
          <div><img src="/images/educator/edu_b-lab-key.png">
            Item 1</div>
          <div><img src="/images/educator/edu_b-lecture-key.png">
            Item 2</div>
          <div><img src="/images/educator/edu_b-present-key.png">
            Item 3</div>
        </div>
        <h3 class="subsubhead">SUB HEADER TEXT</h3>
        <p>INSIDE DIV TEXT</p>
        <div class="clear">&nbsp;</div>
      </div>
      <p>OUTSIDE DIV TEXT</p>
    </div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      "TOP TEXT\n\n- Item 1\n- Item 2\n- Item 3\n\n### SUB HEADER TEXT\nINSIDE DIV TEXT\n\nOUTSIDE DIV TEXT"
    )
  })

  it("should remove pie charts surrounded in a div with the class edu_hours_left", async () => {
    const inputHTML = `<div style="clear: both; position: relative;"></div>
      <div class="edu_hours_left"><canvas id="canvas2" height="100" width="100"
          style="width: 100px; height: 100px;"></canvas>
        <script type="text/javascript">
          var pieData = [{
              value: 28.6,
              color: "#eee"
            },
            {
              value: 71.4,
              color: "#931101"
            }
    
          ];
          var myPie = new Chart(document.getElementById("canvas2").getContext("2d")).Pie(pieData);
        </script> 25 hours per week
      </div>
      <div class="edu_hours_right">
        RIGHT TEXT
      </div>
      <div class="clear">&nbsp;</div>
    </div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, "RIGHT TEXT")
  })

  it("should remove the edu_breakdown section, its key and header", async () => {
    const inputHTML = `<div class="onehalf no_title omega">
      <h2 style="margin-top: -10px;" class="subhead">Semester Breakdown</h2>
      <table class="edu_breakdown">
        <thead>
          <tr>
            <th style="padding-bottom: 8px;" class="week_col" scope="col">WEEK</th>
            <th style="padding-bottom: 8px;" class="day_col" scope="col">M</th>
            <th style="padding-bottom: 8px;" class="day_col" scope="col">T</th>
            <th style="padding-bottom: 8px;" class="day_col" scope="col">W</th>
            <th style="padding-bottom: 8px;" class="day_col" scope="col">Th</th>
            <th style="padding-bottom: 8px;" class="day_col" scope="col">F</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">1</th>
            <td><img alt="No classes throughout MIT." src="/images/educator/edu_b-noclass.png"></td>
            <td><img alt="No session scheduled." src="/images/educator/edu_b-blank.png"></td>
            <td><img alt="No session scheduled." src="/images/educator/edu_b-blank.png"></td>
            <td><img alt="No session scheduled." src="/images/educator/edu_b-blank.png"></td>
            <td><img alt="No session scheduled." src="/images/educator/edu_b-blank.png"></td>
          </tr>
        </tbody>
      </table>
      <div class="edu_breakdown_key">
        <div style="float: left;">
          <div><img
              alt="Displays the color and pattern used on the preceding table to indicate dates when classes are not held at MIT."
              src="/images/educator/edu_b-noclass-key.png"> No classes throughout MIT</div>
          <div><img alt="Displays the color used on the preceding table to indicate dates when class meetings are held."
              src="/images/educator/edu_b-lecture-key.png"> Class meeting</div>
        </div>
        <div style="float: right;">
          <div><img
              alt="Displays the color used on the preceding table to indicate dates when no class session is scheduled."
              src="/images/educator/edu_b-blank-key.png"> No class session scheduled</div>
          <div><img alt="Displays the symbol used on the preceding table to indicate project presentations are held."
              src="/images/educator/edu_b-preslab-key.png"> Project presentations</div>
        </div>
      </div>
    </div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, "")
  })

  it("should properly create youtube shortcodes from placeholder divs", async () => {
    const testId = "F3N5EkMX_ks"
    const inputHTML = `<div class="${YOUTUBE_SHORTCODE_PLACEHOLDER_CLASS}">${testId}</div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, `{{< youtube ${testId} >}}`)
  })

  it(`replaces "approximate students" images with a shortcode`, async () => {
    const inputHTML = `<img src="/courses/electrical-engineering-and-computer-science/6-034-artificial-intelligence-fall-2010/instructor-insights/300-approx.png" alt="300-approx.png" width="105" height="105">`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, "{{< approx-students 300 >}}")
  })

  it(`replaces "approximate students" images prefixed with a UID with a shortcode`, async () => {
    const inputHTML = `<img src="https://open-learning-course-data-production.s3.amazonaws.com/6-034-artificial-intelligence-fall-2010/bb94a5ee3b0f0351808e14b34829d67a_300-approx.png" width="105" height="105">`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, "{{< approx-students 300 >}}")
  })
})
