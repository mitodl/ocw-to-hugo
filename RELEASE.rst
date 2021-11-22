Release Notes
=============

Version 1.35.0
--------------

- div-with-class

Version 1.34.2 (Released November 18, 2021)
--------------

- Add image metadata (#409)

Version 1.34.1 (Released November 18, 2021)
--------------

- Add link to 7.00 F21 and a little sorting (#405)

Version 1.34.0 (Released November 16, 2021)
--------------

- tweak the baseurl turndown rule to apply to images and add tests (#406)

Version 1.33.3 (Released November 01, 2021)
--------------

- Change term to be only the semester without year (#402)
- add external links through 10-29-2021 (#401)
- video downloads
- Update level, year for legacy template (#399)
- Add term and update level in output (#398)

Version 1.33.2 (Released October 26, 2021)
--------------

- generate video gallery front matter (#395)

Version 1.33.1 (Released October 21, 2021)
--------------

- use resource instead of shortcode

Version 1.33.0 (Released October 12, 2021)
--------------

- file not file_location (#390)

Version 1.32.0 (Released October 08, 2021)
--------------

- course images should be a 1:1 relationship (#386)
- Bump path-parse from 1.0.6 to 1.0.7
- parse transcript file

Version 1.31.1 (Released October 01, 2021)
--------------

- move course image urls to legacy data template and set up new data template to generate ocw-studio like resource reference (#378)

Version 1.31.0 (Released September 29, 2021)
--------------

- Fix typo for resourcetype for video pages (#375)

Version 1.30.3 (Released September 22, 2021)
--------------

- Output all uuids with dashes (#362)

Version 1.30.2 (Released September 21, 2021)
--------------

- Change topics export schema to match ocw-studio (#370)

Version 1.30.1 (Released September 20, 2021)
--------------

- Create page for each resource (#337)

Version 1.30.0 (Released September 20, 2021)
--------------

- more ocw studio updates (#366)
- add course_legacy.json (#350)
- revert 'add external links for 3 courses' (#359)
- add external links for 3 courses,
- Update test_data (#358)
- Sort video lecture by order_index (#356)
- Fix broken test for markdown files (#336)

Version 1.29.1 (Released September 17, 2021)
--------------

- Refactor path handling (#342)

Version 1.29.0 (Released September 13, 2021)
--------------

- instructors by uid (#341)

Version 1.28.1 (Released August 30, 2021)
--------------

- Remove course home page from markdown generation (#332)

Version 1.28.0 (Released August 30, 2021)
--------------

- adjust output to more closely match exported courses from ocw-studio (#331)

Version 1.27.0 (Released August 10, 2021)
--------------

- for the course_description property of the data template, transform all urls to document relative (#326)

Version 1.26.1 (Released August 04, 2021)
--------------

- move course description to the course data template (#323)

Version 1.26.0 (Released August 02, 2021)
--------------

- add parent_uid to the front matter on sections that have a parent (#320)

Version 1.25.1 (Released July 23, 2021)
--------------

- separate primary course number and extra course numbers (#318)

Version 1.25.0 (Released July 19, 2021)
--------------

- move nav items to config file (#311)
- Add other pieces of instructor data to course json (#313)

Version 1.24.3 (Released July 15, 2021)
--------------

- Fix issue with a pipe being treated as a string (#314)

Version 1.24.2 (Released July 15, 2021)
--------------

- add captions location as a param to youtube shortcode (#310)

Version 1.24.1 (Released July 15, 2021)
--------------

- add external link to ... (#307)

Version 1.24.0 (Released June 15, 2021)
--------------

- Handle archived courses (#301)

Version 1.23.0 (Released June 11, 2021)
--------------

- move menus.toml to menus.yaml (#300)

Version 1.22.0 (Released June 01, 2021)
--------------

- open learning library (#296)

Version 1.21.1 (Released June 01, 2021)
--------------

- Resolve legacy subtitle URLs (#290)

Version 1.21.0 (Released May 27, 2021)
--------------

- move other_versions to course.json (#292)

Version 1.20.0 (Released May 18, 2021)
--------------

- display updated course numbers (#279)
- add lookup for other versions based on master subject (#283)
- remove default salutation

Version 1.19.1 (Released May 14, 2021)
--------------

- Add 11.405 to external link list (#277)
- upgrade a few packages

Version 1.19.0 (Released April 28, 2021)
--------------

- Bump y18n from 4.0.0 to 4.0.1 (#245)

Version 1.18.0 (Released April 21, 2021)
--------------

- use salutation if it exists (#258)

Version 1.17.1 (Released April 09, 2021)
--------------

- use course_feature_tags (#249)

Version 1.17.0 (Released April 07, 2021)
--------------

- video page baseurl (#252)
- popup video links (#246)

Version 1.16.1 (Released April 02, 2021)
--------------

- Add course info links (#244)

Version 1.16.0 (Released March 30, 2021)
--------------

- external nav links (#239)

Version 1.15.1 (Released March 26, 2021)
--------------

- pad double line breaks with spaces (#238)
- add turndown rule for headings inside a table to transform them into shortcodes (#234)

Version 1.15.0 (Released March 22, 2021)
--------------

- remove unnecessary escape calls (#230)

Version 1.14.0 (Released March 19, 2021)
--------------

- better colspan handling (#227)
- use leftnav for menu name (#225)

Version 1.13.0 (Released March 10, 2021)
--------------

- single course output structure (#216)
- approx-students turndown rule (#208)

Version 1.12.1 (Released March 04, 2021)
--------------

- youtube shortcode refactor (#211)
- create pdf viewer pages for course home page pdfs (#205)

Version 1.12.0 (Released February 25, 2021)
--------------

- fix path generation log message (#203)
- add turndown rule to match and remove semester breakdown chart, header and key (#200)
- lowercase pdf name in links (#201)
- modify pie chart turndown rule to include the text content of the key inside edu_breakdown_key (#199)

Version 1.11.0 (Released February 17, 2021)
--------------

- Fix external links (#191)
- remove course home from left nav (#185)
- Handle external course links (#187)
- remove instructor insights pie charts (#184)
- Update and fix link processing (#175)
- Fix code coverage (#183)

Version 1.10.0 (Released February 08, 2021)
--------------

- Refactor link processing (#176)
- parent title (#172)
- add quote shortcode (#170)
- add instructor_insights layout (#169)

Version 1.9.0 (Released January 19, 2021)
-------------

- fix image tag rendering (#166)

Version 1.8.0 (Released January 12, 2021)
-------------

- preserve UID on course home pages when possible (#155)
- Refactor resolveRelativeLinks (#158)
- Change PDF extension handling to be case insensitive (#157)

Version 1.7.0 (Released December 22, 2020)
-------------

- don't process unpublished courses (#150)

Version 1.6.0 (Released December 15, 2020)
-------------

- Switch to github actions (#147)
- Remove "Course Home" from course page title (#142)

Version 1.5.0 (Released December 01, 2020)
-------------

- store course metadata in hugo data templates (#134)
- refactor: move turndown out into a separate file
- upgrade turndown

Version 1.4.0 (Released November 24, 2020)
-------------

- add optional argument to clear destination directory before conversion (#131)
- Fix course resolveuid links (#127)

Version 1.3.1 (Released November 17, 2020)
-------------

- Change topics to return a list with dicts (#119)

Version 1.3.0 (Released November 16, 2020)
-------------

- add support for rendering simplecast files
- Add course_title and course_info to section pages (#120)
- Remove title from boilerplate (#118)

Version 1.2.0 (Released November 10, 2020)
-------------

- refactor master -> parsed and uid -> short_url (#113)

Version 1.1.0 (Released November 06, 2020)
-------------

- Use first_published_to_production instead (#115)

Version 1.0.12 (Released October 28, 2020)
--------------

- fix embedded media nav bug (#110)
- Remove logged error if the course is skipped and no course JSON is set (#105)
- Increase timeout on file_operations tests (#108)
- Generate markdown for bottom text if it exists (#107)
- Convert videos to markdown, instead of relying on the hugo videogallery layout (#106)
- 1.0.11
- Handle an empty string for instructors (#103)
- 1.0.10
- Add lastpublished data to course front matter (#101)
- Error if master JSON is missing for a course and the user has a course list (#100)
- 1.0.9

