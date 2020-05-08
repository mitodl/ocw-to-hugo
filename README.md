# ocw-to-hugo

## Installation

```shell
$ cd ~/path/to/temp/dir
$ git clone git@github.com:mitodl/ocw-to-hugo.git
$ cd ocw-to-hugo
$ npm install -g .
```

## Usage

```shell
$ ocw-to-hugo -c <courses.json location> -s <source directory> -d <destination directory>
```

This utility optionally takes a JSON file of OCW course ID's, formatted as:

```json
{
    "courses": [
        "12-001-introduction-to-geology-fall-2013",
        "14-01sc-principles-of-microeconomics-fall-2011",
		...
    ]
}
```

These courses will be downloaded to the specified source directory, and converted to the Hugo markdown structure used by hugo-course-publisher.  If no courses JSON is specified, ocw-to-hugo assumes you have already downloaded your courses and placed them in your source directory.

## Arguments

| Argument | Required? | Valid values  |
| :------- | :-------- | :------------ |
| `c`      | No  | `/path/to/courses.json` |
| `s`      | Yes | `/path/to/open-learning-course-data` |
| `d`      | Yes | `/path/to/hugo-markdown-output` |

## Environment Variables
| Variable | Description  |
| :------- | :------------ |
| `AWS_REGION` | The AWS region to connect to, i.e. `us-east-1` |
| `AWS_BUCKET_NAME` | The bucket to use, i.e. `open-learning-course-data-ci` |
| `AWS_ACCESS_KEY` | Your AWS Access Key with access to said bucket |
| `AWS_SECRET_ACCESS_KEY` | The secret access key that pairs with your access key |