Release Notes
=============

Version 1.10.1
--------------

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

