const { assert } = require("chai").use(require("sinon-chai"))
const { html2markdown } = require("./turndown")
const { EMBEDDED_RESOURCE_SHORTCODE_PLACEHOLDER_CLASS } = require("./constants")

describe("turndown", () => {
  describe("tables", () => {
    const tableHTML = `<table summary="See table caption for summary." class="tablewidth100">
    <caption class="invisible">Course readings.</caption> <!-- BEGIN TABLE HEADER (for MIT OCW Table Template 2.51) -->
    <thead>
      <tr>
        <th scope="col">LEC&nbsp;#</th>
        <th scope="col">TOPICS</th>
        <th scope="col">READINGS&nbsp;(3D&nbsp;ED.)</th>
        <th scope="col">READINGS&nbsp;(4TH&nbsp;ED.)</th>
      </tr>
      <tr>
        <th colspan="2" rowspan="4">full colspan double rowspan test</th>
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
        <td><h1>TEST</h1></td>
        <td><h2>TEST 2</h2></td>
      </tr>
      <tr>
        <td colspan="2" rowspan="4">full colspan double rowspan test</td>
      </tr>
      <tr class="alt-row">
        <td><p><em>italics wrapped in a paragraph</em></p></td>
        <td><div><em>italics wrapped in a div</em></div></td>
        <td><p><strong>strong wrapped in a paragrah</strong></p></td>
        <td><div><strong>strong wrapped in a div</strong></div></td>
      </tr>
    </tbody>
  </table>`
    const tableMarkdown = `{{< tableopen >}}
{{< theadopen >}}
{{< tropen >}}
{{< thopen >}}
LEC #
{{< thclose >}}
{{< thopen >}}
TOPICS
{{< thclose >}}
{{< thopen >}}
READINGS (3D ED.)
{{< thclose >}}
{{< thopen >}}
READINGS (4TH ED.)
{{< thclose >}}

{{< trclose >}}
{{< tropen >}}
{{< thopen colspan="2" rowspan="4" >}}
full colspan double rowspan test
{{< thclose >}}

{{< trclose >}}

{{< theadclose >}}
{{< tropen >}}
{{< tdopen colspan="4" >}}
**Control and Scope**
{{< tdclose >}}

{{< trclose >}}
{{< tropen >}}
{{< tdopen >}}
L 1
{{< tdclose >}}
{{< tdopen >}}
Course Overview, Introduction to Java
{{< tdclose >}}
{{< tdopen >}}
—
{{< tdclose >}}
{{< tdopen >}}
—
{{< tdclose >}}

{{< trclose >}}
{{< tropen >}}
{{< tdopen colspan="4" >}}


**Wrapped in a paragraph**


{{< tdclose >}}

{{< trclose >}}
{{< tropen >}}
{{< tdopen >}}
L 2
{{< tdclose >}}
{{< tdopen >}}
Test table section 2
{{< tdclose >}}
{{< tdopen >}}


TEST
====


{{< tdclose >}}
{{< tdopen >}}


TEST 2
------


{{< tdclose >}}

{{< trclose >}}
{{< tropen >}}
{{< tdopen colspan="2" rowspan="4" >}}
full colspan double rowspan test
{{< tdclose >}}

{{< trclose >}}
{{< tropen >}}
{{< tdopen >}}


_italics wrapped in a paragraph_


{{< tdclose >}}
{{< tdopen >}}


_italics wrapped in a div_


{{< tdclose >}}
{{< tdopen >}}


**strong wrapped in a paragrah**


{{< tdclose >}}
{{< tdopen >}}


**strong wrapped in a div**


{{< tdclose >}}

{{< trclose >}}

{{< tableclose >}}`

    it("should properly transform a table into a shortcode representation", async () => {
      /**
       * Turndown seems to insert some strange whitespace characters,
       * so here we're replacing them with normal spaces.  If you run this
       * comparison without the .replace, the test will fail but the strings
       * are identical
       */
      const markdown = await html2markdown(tableHTML).replace(/[^\S\r\n]/g, " ")
      assert.equal(markdown, tableMarkdown)
    })
  })

  it("should properly convert 1 liner code snippet into its correct markdown", async () => {
    const inputHTML = `<span style="font-family: Courier New,Courier;">sudo apt-get install -y python2.7 python-profiler</span>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      "`sudo apt-get install -y python2.7 python-profiler`"
    )
  })

  it("should properly convert code block into its correct markdown", async () => {
    const inputHTML = `<pre>import time<br>print('I am going to sleep :)')<br>time.sleep(1000)</pre>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      "```import time  \nprint('I am going to sleep :)')  \ntime.sleep(1000)```"
    )
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

  it("should not escape other markdown characters inside link text", async () => {
    const problematicHTML = `<a href="syllabus"><strong>bold test</strong</a>`
    const markdown = await html2markdown(problematicHTML)
    assert.equal(markdown, `[**bold test**](syllabus)`)
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

  it("should return a baseurl shortcode in a link if the placeholder is there", async () => {
    const inputHTML = `<a href="BASEURL_PLACEHOLDER/test-section/page">link text</a>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, "[link text]({{< baseurl >}}/test-section/page)")
  })

  it("should return a path to an image resource prefixed with the baseurl shortcode if it's linked in an a tag", async () => {
    const inputHTML = `<a href="RESOURCE_FILE_PLACEHOLDER 05e36cd1-b32f-4b27-9fda-6173ec926253 /resources/image"" >test image</a>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, "[test image]({{< baseurl >}}/resources/image)")
  })

  it("should return a resource_file shortcode in an img src if the placeholder is there", async () => {
    const inputHTML = `<img src="RESOURCE_FILE_PLACEHOLDER 05e36cd1-b32f-4b27-9fda-6173ec926253 /resources/image" alt="test image" />`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      "![test image]({{< resource_file 05e36cd1-b32f-4b27-9fda-6173ec926253 >}})"
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

  it("removes the classroom section", async () => {
    const inputHTML = `
    <div class="onethird alpha">
        <h2 class="title">Curriculum Information</h2>
        <div>Foo bar baz</div>
    </div>
    <div class="twothirds omega anythingSlider anythingSlider-default activeSlider">
        <a name="classroom"></a>
        <h2 class="title">The Classroom</h2>
        <div>Lots of pictures of desks</div>
    </div>
    <div class="clear">&nbsp;</div>
    <div class="onehalf alpha"><a name="assessment"></a>
        <h2 class="title">Assessment</h2>
        <a name="not-a-classroom">meow</a>
        <p>The students' grades were based on the following activities:</p>
    </div>
    <div>
        <h2>If classroom is a child</h2>
        <div>
            <a name="classroom"></a>
        </div>
        The section should live on.
    </div>
    `.trim()
    const expectedMarkdown = `
Curriculum Information
----------------------

Foo bar baz

{{< anchor "assessment" >}}{{< /anchor >}}

Assessment
----------

{{< anchor "not-a-classroom" >}}meow{{< /anchor >}}

The students' grades were based on the following activities:

If classroom is a child
-----------------------

The section should live on.
    `.trim()

    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, expectedMarkdown)
  })

  it("should properly create youtube shortcodes from placeholder divs", async () => {
    const uid = "d1eb865e-ba7f-9989-0be1-348ba7cad5bd"

    const inputHTML = `<div class="${EMBEDDED_RESOURCE_SHORTCODE_PLACEHOLDER_CLASS}">${uid}</div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, `{{< resource ${uid} >}}`)
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

  it(`replaces divs with "toggle" in the class name with a shortcode`, async () => {
    const inputHTML = `<div class="toggle1">Click Me</div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      `{{< div-with-class "toggle1">}}Click Me{{< /div-with-class >}}`
    )
  })

  it(`replaces divs with "reveal" in the class name with a shortcode`, async () => {
    const inputHTML = `<div class="reveal1">Show Me</div>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      `{{< div-with-class "reveal1">}}Show Me{{< /div-with-class >}}`
    )
  })

  it("parses multiple choice questions", async () => {
    const inputHTML = `
      <p>Which is allowed in Python?</p>
      <div id="Q2_div" class="problem_question"><fieldset><legend class="visually-hidden">Exercise 2</legend>
      <div class="choice"><label id="Q2_input_1_label"><span id="Q2_input_1_aria_status" tabindex="-1" class="visually-hidden">&amp;nbsp;</span><input id="Q2_input_1" onclick="optionSelected(2)" name="Q2_input" class="problem_radio_input" correct="false" type="radio" /><span class="choice">x + y = 2</span><span id="Q2_input_1_normal_status" class="nostatus" aria-hidden="true">&amp;nbsp;</span></label></div>
      <div class="choice"><label id="Q2_input_2_label"><span id="Q2_input_2_aria_status" tabindex="-1" class="visually-hidden">&amp;nbsp;</span><input id="Q2_input_2" onclick="optionSelected(2)" name="Q2_input" class="problem_radio_input" correct="false" type="radio" /><span class="choice">x*x = 2</span><span id="Q2_input_2_normal_status" class="nostatus" aria-hidden="true">&amp;nbsp;</span></label></div>
      <div class="choice"><label id="Q2_input_3_label"><span id="Q2_input_3_aria_status" tabindex="-1" class="visually-hidden">&amp;nbsp;</span><input id="Q2_input_3" onclick="optionSelected(2)" name="Q2_input" class="problem_radio_input" correct="false" type="radio" /><span class="choice">2 = x</span><span id="Q2_input_3_normal_status" class="nostatus" aria-hidden="true">&amp;nbsp;</span></label></div>
      <div class="choice"><label id="Q2_input_4_label"><span id="Q2_input_4_aria_status" tabindex="-1" class="visually-hidden">&amp;nbsp;</span><input id="Q2_input_4" onclick="optionSelected(2)" name="Q2_input" class="problem_radio_input" correct="true" type="radio" /><span class="choice">xy = 2</span><span id="Q2_input_4_normal_status" class="nostatus" aria-hidden="true">&amp;nbsp;</span></label></div>
      <div class="choice"><label id="Q2_input_5_label"><span id="Q2_input_5_aria_status" tabindex="-1" class="visually-hidden">&amp;nbsp;</span><input id="Q2_input_5" onclick="optionSelected(2)" name="Q2_input" class="problem_radio_input" correct="false" type="radio" /><span class="choice">None of the Above</span><span id="Q2_input_5_normal_status" class="nostatus" aria-hidden="true">&amp;nbsp;</span></label></div>
      </fieldset></div>
      <div class="action"><button id="Q2_button" onclick="checkAnswer({2: 'multiple_choice'})" class="problem_mo_button">Check</button><button id="Q2_button_show" onclick="showHideVidSolution({2: 'multiple_choice'}, 2, [2])" class="problem_mo_button">Show Answer Videos</button></div>
      <div id="S2_div" class="problem_solution" tabindex="-1">
      <p>15286813pythonvs.math14606776</p>
      </div>
    `
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      `Which is allowed in Python?\n\n{{< quiz_multiple_choice questionId="Q2_div" >}}` +
        `{{< quiz_choices >}}` +
        `{{< quiz_choice isCorrect="false" >}}&nbsp;x + y = 2&nbsp;{{< /quiz_choice >}}\n` +
        `{{< quiz_choice isCorrect="false" >}}&nbsp;x\\*x = 2&nbsp;{{< /quiz_choice >}}\n` +
        `{{< quiz_choice isCorrect="false" >}}&nbsp;2 = x&nbsp;{{< /quiz_choice >}}\n` +
        `{{< quiz_choice isCorrect="true" >}}&nbsp;xy = 2&nbsp;{{< /quiz_choice >}}\n` +
        `{{< quiz_choice isCorrect="false" >}}&nbsp;None of the Above&nbsp;{{< /quiz_choice >}}` +
        `{{< /quiz_choices >}}\n` +
        `{{< quiz_solution >}}15286813pythonvs.math14606776{{< /quiz_solution >}}` +
        `{{< /quiz_multiple_choice >}}`
    )
  })

  it("parses multiple choice widget questions", async () => {
    const inputHTML = `
      <script type="text/javascript">

        $( function($){
          var quizMulti = {
            multiList: [
              {
                ques: "If you compare the elasticity of short-run supply in the markets for two different goods and one market has more firms than the other, which will have a more elastic supply curve?",
                ans: "The market with more firms.",
                ansSel: ["The market with fewer firms.", "There is no difference.", "It depends on the specific production function."],
                ansInfo: "The supply curve becomes flatter (more elastic) with more firms in the market, because a given increase in price calls forth more production when there are many firms rather than one."
              },
              {
                ques: "In the long run, firms should decide to shut down if what condition holds?",
                ans: "Price is less than both average cost and average variable cost.",
                ansSel: ["Price is less than average variable cost.", "Price is less than average cost.", "Price is less than average fixed cost."],
                ansInfo: "In the long run, all costs are variable, and thus average variable cost and average cost are equivalent. The firm will shut down if price is less than average cost. Average fixed cost is not a relevant concept in the long-run, because all costs are considered to be variable."
              }
            ]
          };
          var options = {
            allRandom: false,
            Random: false,
            help: "",
            showHTML: false,
            animationType: 0,
            showWrongAns: true,
            title: "Concept test 1",
        };
        $("#quizArea").jQuizMe(quizMulti, options);
        });
      </script>`
    const markdown = await html2markdown(inputHTML)
    assert.equal(
      markdown,
      `##### Question 1\n ` +
        `{{< quiz_multiple_choice questionId="MCQ1" >}} ` +
        `If you compare the elasticity of short-run supply in the markets for ` +
        `two different goods and one market has more firms than the other, ` +
        `which will have a more elastic supply curve? ` +
        `{{< quiz_choices >}} ` +
        `{{< quiz_choice isCorrect="false" >}}It depends on the specific production function.` +
        `{{< /quiz_choice >}} ` +
        `{{< quiz_choice isCorrect="false" >}}The market with fewer firms.{{< /quiz_choice >}} ` +
        `{{< quiz_choice isCorrect="true" >}}The market with more firms.{{< /quiz_choice >}} ` +
        `{{< quiz_choice isCorrect="false" >}}There is no difference.{{< /quiz_choice >}} ` +
        `{{< /quiz_choices >}} ` +
        `{{< quiz_solution >}}The supply curve becomes flatter (more elastic) with more firms` +
        ` in the market, because a given increase in price calls forth more production when` +
        ` there are many firms rather than one.{{< /quiz_solution >}} ` +
        `{{< /quiz_multiple_choice >}}\n` +
        `##### Question 2\n ` +
        `{{< quiz_multiple_choice questionId="MCQ2" >}} ` +
        `In the long run, firms should decide to shut down if what condition holds? ` +
        `{{< quiz_choices >}} ` +
        `{{< quiz_choice isCorrect="false" >}}Price is less than average cost.{{< /quiz_choice >}} ` +
        `{{< quiz_choice isCorrect="false" >}}Price is less than average fixed cost.{{< /quiz_choice >}} ` +
        `{{< quiz_choice isCorrect="false" >}}Price is less than average variable cost.` +
        `{{< /quiz_choice >}} ` +
        `{{< quiz_choice isCorrect="true" >}}Price is less than both average cost and average ` +
        `variable cost.{{< /quiz_choice >}} ` +
        `{{< /quiz_choices >}} ` +
        `{{< quiz_solution >}}In the long run, all costs are variable, and thus average variable ` +
        `cost and average cost are equivalent. The firm will shut down if price is less ` +
        `than average cost. Average fixed cost is not a relevant concept in the long-run, ` +
        `because all costs are considered to be variable.{{< /quiz_solution >}} ` +
        `{{< /quiz_multiple_choice >}}`
    )
  })

  it("should preserve escaped angle brackets", async () => {
    const inputHTML = `
&gt; Initial &gt; are escaped by turndown since they are markdown blockquotes.
<ol>
  <li>
    a &lt;a second&gt;
  </li>
  <li>
    b \\&lt;
  </li>
  <li>
    <code>x &lt; y</code> code is not escaped
  </li>
<ol>
`
    const expectedMarkdown = `
\\> Initial > are escaped by turndown since they are markdown blockquotes.

1.  a \\<a second>
2.  b \\\\\\<
3.  \`x < y\` code is not escaped
`.trim()
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, expectedMarkdown)
  })

  it("converts sup tags to sup shortcodes", async () => {
    const inputHTML = `
    <div>
    <p>The 25<sup>th</sup> annual Jabberwocky<sup>&reg;</sup></p>
    
    Some more
      <ol>
        <li>nesting won't work well cats<sup>me<sup>ow</sup></sup> </li>
        <li>boldings <sup>normal text <strong>bold woof</strong> and <em>emph</em></sup> </li>
        <li>and quotes although <sup>who puts "quotes" in</sup> superscripts though?</li>
      </ol>
    </div>
    `
    const expectedMarkdown = `
The 25{{< sup "th" >}} annual Jabberwocky{{< sup "®" >}}

Some more

1.  nesting won't work well cats{{< sup "me{{< sup \\"ow\\" >}}" >}}
2.  boldings {{< sup "normal text **bold woof** and _emph_" >}}
3.  and quotes although {{< sup "who puts \\"quotes\\" in" >}} superscripts though?
    `.trim()
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, expectedMarkdown)
  })

  it("converts sub tags to sub shortcodes", async () => {
    const inputHTML = `
    <div>
    <p>The 25<sub>th</sub> annual Jabberwocky<sub>&reg;</sub></p>
    
    Some more
      <ol>
        <li>nesting won't work well cats<sub>me<sub>ow</sub></sub> </li>
        <li>boldings <sub>normal text <strong>bold woof</strong> and <em>emph</em></sub> </li>
        <li>and quotes although <sub>who puts "quotes" in</sub> subscripts though?</li>
      </ol>
    </div>
    `
    const expectedMarkdown = `
The 25{{< sub "th" >}} annual Jabberwocky{{< sub "®" >}}

Some more

1.  nesting won't work well cats{{< sub "me{{< sub \\"ow\\" >}}" >}}
2.  boldings {{< sub "normal text **bold woof** and _emph_" >}}
3.  and quotes although {{< sub "who puts \\"quotes\\" in" >}} subscripts though?
    `.trim()
    const markdown = await html2markdown(inputHTML)
    assert.equal(markdown, expectedMarkdown)
  })
})
