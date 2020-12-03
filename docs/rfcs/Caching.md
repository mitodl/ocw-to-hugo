# Caching Markdown for Fun and Profit

## Abstract

This RFC details a proposal for caching the output of `ocw-to-hugo` between
runs in order to skip re-running turndown and so on for courses which have not
changed. The cache location will be configurable, with a default location.
Cached course content will be stored as a gzipped tar archive (`.tgz` file),
and course data (`.json` file) will be copied directly to the cache. Initial
tests with a draft implementation show that running `ocw-to-hugo` with a warm
cache cuts build time to around 

## Caching algorithm

## Cache location



## Performance

This is looking at the performance of the [draft
implementation](https://github.com/mitodl/ocw-to-hugo/pull/143), which hasn't
really been optimized or 'tuned' at all. There is a good deal of additional i/o
as compared with current `master`, mainly in the form of additional calls to
`ls` and then `fs.statSync`.

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




