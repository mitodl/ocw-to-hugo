# What's this
This is work toward [verify that all the expected courses are exported, imported and published](https://github.com/mitodl/ocw-to-hugo/issues/445).

So far, this can be used to:
1. download a list of key names from an s3 bucket such as  `ocw-content-storage`.
2. Compare the keys in the bucket to a local list of courses exported from plone

## Running
Run via
```
npm run compare-course-lists -- -i path/to/input -o path/to/output
```
where:
- `-i` specifies path to input directory, containing:
    - `plone_ocw_course_list.csv` list of courses exported from plone, such as that given in https://github.com/mitodl/ocw-to-hugo/issues/445#issuecomment-1030123015
    - (optional) `s3_coursefile_keylist` list of s3 keys for course files; can be downloaded from amazon with `-d` option
- `-o` specifies path to output directory

    `s3_coursefile_keylist.json` will be written to this directory if `-d` is specified an relevant environment variables are provided:

    COURSE_CHECK_AWS_BUCKET_NAME=
    COURSE_CHECK_AWS_REGION=
    COURSE_CHECK_AWS_SECRET_KEY=
    COURSE_CHECK_AWS_ACCESS_KEY_ID=