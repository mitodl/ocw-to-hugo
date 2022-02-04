# Detect Duplicates

Detect duplicate course data in a bucket like parsed course data bucket.

Gets list of all course data in the bucket, downloads the `course_parsed.json` files, and looks for files with with the same UID.

## Running
Run via
```
npm run detect-duplicates -- -i path/to/input -o path/to/output
```
where:
- `-i` specifies path to input directory, containing:
    - (optional) `combined_meta.json`, produced by running with `--download` option
- `-o` specifies path to output directory

    `combined_meta.json` will be written to this directory if `--download` is specified and relevant environment variables are provided:

    DUPLICATE_CHECK_AWS_BUCKET_NAME=
    DUPLICATE_CHECK_AWS_REGION=
    DUPLICATE_CHECK_AWS_SECRET_KEY=
    DUPLICATE_CHECK_AWS_ACCESS_KEY_ID=