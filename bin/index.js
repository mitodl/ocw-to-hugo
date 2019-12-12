#!/usr/bin/env node

var fs = require('fs');
const yargs = require("yargs");

const options = yargs
 .usage("Usage: -s <path>")
 .option("s", { alias: "source", describe: "Source directory of courses", type: "string", demandOption: true })
 .option("d", { alias: "destination", describe: "Destination directory for Hugo markdown", type: "string", demandOption: true })
 .argv;

if (options.source && fs.lstatSync(options.source).isDirectory()) {
    fs.readdir(options.source, function(err, directories) {
        console.log("Scanning subdirectories under " + options.source);
        directories.forEach(directory => {
            var course_path = options.source + "/" + directory;
            if (fs.lstatSync(course_path).isDirectory()) {
                fs.readdir(course_path, function(err, files) {
                    files.forEach(file => {
                        if (file.indexOf("_master.json") > -1) {
                            course_data = JSON.parse(fs.readFileSync(course_path + "/" + file));
                            process_json(course_data);
                        }
                    });
                });
            }
        });
    });
}
else {
    console.log("Invalid source directory");
}

function process_json(course_data) {
    // TODO: process the master JSON and generate markdown
}