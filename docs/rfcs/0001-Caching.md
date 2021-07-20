# Caching Markdown for Fun and Profit

## Abstract

This RFC details a proposal for caching the output of `ocw-to-hugo` between
runs in order to skip re-running turndown and so on for courses which have not
changed. The cache location will be configurable, with a default location.
Cached course content will be stored as a gzipped tar archive (`.tgz` file),
and course data (`.json` file) will be copied directly to the cache. Initial
tests with a [proof-of-concept
implementation](https://github.com/mitodl/ocw-to-hugo/pull/143) show that
running `ocw-to-hugo` with a warm cache cuts build time to under 20% of the
current build time.

## Overview and justification

The basic idea is to cache the _output_ of `ocw-to-hugo` in a per-course
fashion, so that we can detect when a single course needs to be re-converted
and when we can skip doing so. If we've already done the work we can simply
pull it out of the cache, skipping the expensive step of parsing all the course
HTML and converting to markdown.

There is reason to expect this will save us a lot of time in real-world use.
Many of the courses in the full course set are old, and the content in them is
not liable to change frequently (with the exception of changes introduced by
changes to `ocw-data-parser`).

The caching approach will rely on a cache directory outside of the project
directory. Full, complete courses will be saved as gzipped tar archives and
copied to that directory, alongside course data JSON files.

Another approach could be to examine the markdown already present in the output
directory (the `-o` command line option) and skip rendering if the markdown
present is newer than the input data.  While this approach would obviate the
need for an external cache directory, it does have some drawbacks that make it
undesirable. Namely, if a course were updated to remove a file we could
potentially leave stale markdown present in the course directory. For this
reason it's best to stick with our current approach of removing content in the
destination directory and re-generating it on each run, in essence viewing the
content in the output directory as a transient artifact.

## Caching algorithm

The basic idea here is to avoid doing any work we don't need to do. We need to
skip the cache if the input data is newer than the cached data or if the cached
data was generated with an older version of `ocw-to-hugo` (and could therefore
be incompatible with the version of `hugo-course-publisher` we intend to use).

Based on these requirements, I propose the following algorithm:

1. let `current_version` be a string representation of the current version of
   `ocw-to-hugo`
1. let `output` be the output specified with the `-o` option on the
   command-line
1. let `CACHE_DIR` be the cache directory
1. for each course in the input:
    1. let `course_id` be the course's UUID (`short_url` in the input data).
    1. let `inputLastModified` be the last modified date for the course. This
       is calculcated by looking at the last modified time for the
       `_parsed.json` file for the course, since any file or content changes
       would cause that file to change as well.
    1. let `cacheLastModified` be the last modified date for cached content for
       that course
    1. let `is_stale` be `inputLastModified > cacheLastModified`
    1. let `cache_version` be the version ID written in the filenames for the
    cached content
    - if `is_stale` or `cache_version !== current_version` or course not
      present in cache:
        1. convert markdown, and write markdown into directory
        `${output}/content/courses/${course_id}`
        1. write data template to `${output}/data/courses/${course_id}.json`
        1. create a tar archive of `${output}/content/courses/${course_id}`
        1. write tar archive to
        `${CACHE_DIR}/${course_id}_${current_version}.tgz`
        1. copy `${output}/data/courses/${course_id}.json` to
        `${CACHE_DIR}/${course_id}_${version_id}.json`
    - else:
        1. untar `${CACHE_DIR}/${course_id}_${current_version}.tgz` in
        `${output}/content/courses/`
        1. copy `${CACHE_DIR}/${course_id}_${current_version}.json` to
        `${output}/data/courses/${course_id}.json`

I believe this will cover our bases. We want to invalidate the cache whenever the
data in it is stale or was generated with an older version of `ocw-to-hugo`.
Otherwise, we are good to use the cached data and skip running the HTML through
our conversion process.

## Implementation

A few little details and preliminary thinking.

### dependencies

The [draft / proof of concept
implementation](https://github.com/mitodl/ocw-to-hugo/pull/143) uses the
[node-tar](https://github.com/npm/node-tar) library for compression. It is a
flexible library which has usage patterns similar to the Unix `tar` command. It
can be used synchronously or asynchronously, with promises, callbacks, or using
a streaming API. Other than that the only dependencies are node.js built-in
modules like `os`, `path`, and `fs`.

### API

The cache will be implemented as a CommonJS module exporting 3 functions:

```
stale: (courseId: string, inputPath: string) => Promise<boolean>
save: (courseId: string) => Promise<undefined>
load: (courseId: string) => Promise<undefined>
```

`stale` basically just wraps up checking whether the source data is newer than
the cached data. The version number check isn't implemented yet, but this will
probably be integrated into this method too for simplicity's sake.

`save` takes a `courseId` performs the steps of creating the `.tgz` archive,
copying it to the cache directory, and then copying the data template.

`load` takes a `courseId` and does the opposite: it unpacks the `.tgz` archive
at the right spot and likewise copies the data template `.json` file to its
rightful home.

I considered implementing the cache as an object with an ES6 class, but I think
it's not really necessary.

The intended use is like this:

```js
const cache = require("./cache")

if (await cache.stale(courseId, inputPath)) {
  // write markdown and template
  await cache.save(courseId)
} else {
  await cache.load(courseId)
}
```

## Cache location

The cache location will be configurable, either with an environment variable or
a command-line argument. It will default to `~/.cache/ocw-to-hugo`.

## Performance

This is looking at the performance of the [draft
implementation](https://github.com/mitodl/ocw-to-hugo/pull/143), which hasn't
really been optimized or 'tuned' at all. There is a good deal of additional i/o
as compared with current `master`, mainly in the form of additional calls to
`ls` and then `fs.statSync`. By checking only the `mtime` of `_parsed.json`
we'll remove the need for a lot Those calls.

There's two relevant things to examine: runtime and cache size.

### Runtime

To get a sense of the run-time difference I ran `ocw-to-hugo` against the full
course set on my laptop. This won't be precisely representative of the build
time on the build server, but should give us an idea.

On `master`, running

```
time node ./src/bin/index.js -i private/courses -o private/output --strips3
```

returns

```
156.78s user 17.09s system 121% cpu 2:23.07 total
```

on the draft caching implementation, with no cache it returns:

```
192.25s user 19.80s system 121% cpu 2:53.95 total
```

with a warm cache (i.e. immediately after that run) it returns:

```
26.37s user 12.78s system 150% cpu 25.980 total
```

It appears that there is some overhead associated with the caching algorithm,
which has not yet been optimized, so a cache-less run takes a little bit longer
(~20s) than a full run on `master`. However, with a warm cache (i.e. with all
courses cached) the run finishes in ~17% of the time.


### Cache size

Running against the full course set on my laptop generates around 200MB of
cached stuff, so I think this is what we can expect for the cache size typically.

## Rollout

Deployment of a new version implementing caching will not be terribly
difficult. DevOps will need to be made aware of the change when a hugo release
depending on a caching version of `ocw-to-hugo` is going to be deployed. DevOps
will need to decide where it makes sense to store the cache on the build
server, and will need to set configuration accordingly. No changes to the build
script should be necessary.
