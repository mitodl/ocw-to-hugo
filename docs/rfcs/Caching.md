# Caching Markdown for Fun and Profit


### Abstract

This RFC details a proposal for caching the output of `ocw-to-hugo` between
runs in order to skip re-running turndown and so on for courses which have not
changed. The cache location will be configurable, with a default location.
Cached course content will be stored as a gzipped tar archive (`.tgz` file),
and course data (`.json` file) will be copied directly to the cache. Initial
tests with a draft implementation show that running `ocw-to-hugo` with a warm
cache cuts build time to around 
