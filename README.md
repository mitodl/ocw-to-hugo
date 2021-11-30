# ocw-to-hugo

## Installation

These examples demonstrate installing `ocw-to-hugo` globally, as it is designed
to be a command line utility that can be run from anywhere in the system.
However, you may omit the global flag if you wish to install it into another
project.

### From source
```shell
$ cd ~/path/to/temp/dir
$ git clone git@github.com:mitodl/ocw-to-hugo.git
$ cd ocw-to-hugo
$ npm install -g .
```
### From npm
```shell
$ npm install -g @mitodl/ocw-to-hugo
```

## Usage

```shell
$ ocw-to-hugo -c <courses.json location> --download -i <input directory> -o <output directory>
```

This utility optionally takes a JSON file of OCW course ID's.  Various examples
of this can be found in the `course_json_examples` folder, but generally it is
formatted as:

```json
{
    "courses": [
        "12-001-introduction-to-geology-fall-2013",
        "14-01sc-principles-of-microeconomics-fall-2011"
    ]
}
```

If the `-c` option has been specified, processing will be filtered by the
courses specified in the format above. If the `--download` flag is set, the
courses listed will first be downloaded from AWS to the input directory
specified with `-i`. When downlading courses, `ocw-to-hugo` automatically
determines if it needs to re-download a file by comparing dates. If
`--download` is not set, the source for the courses specified in the JSON must
already exist in the input directory.  If any of the courses are not there, an
error will be thrown. If you wish to simply process an input directory of
courses without downloading or filtering, use only the `-i` and `-o` arguments.


## Arguments

| Argument | Required? | Valid values  | Description |
| :------- | :-------- | :------------ | :------------ |
| `-i, --input`      | Yes | `/path/to/open-learning-course-data` | Input folder of OCW course folders containing `parsed.json` files and optionally static content |
| `-o, --output`      | Yes | `/path/to/hugo-markdown-output` | Output path to place processed courses in |
| `-c, --courses`      | Only if download flag is true  | `/path/to/courses.json` | If enabled, courses processed will be filtered based on the format above |
| `--download`      | No  | `true or false` | Download `parsed.json` files from a configured S3 bucket and a list of courses passed in with `-c` |
| `--strips3`       | No  | `true or false` | Strip the s3 base URL from all OCW resources |
| `--staticPrefix`       | No  | `/path/to/static/assets` | When `--strips3` is set to true, replace the s3 base URL with this string |
| `--rm` | No | `true or false` | Clear the contents of the path passed with `-o` before the conversion run |

## Environment Variables
| Variable | Description  |
| :------- | :------------ |
| `AWS_REGION` | The AWS region to connect to, i.e. `us-east-1` |
| `AWS_BUCKET_NAME` | The bucket to use, i.e. `open-learning-course-data-ci` |
| `AWS_ACCESS_KEY` | Your AWS Access Key with access to said bucket |
| `AWS_SECRET_ACCESS_KEY` | The secret access key that pairs with your access key |
