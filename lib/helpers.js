#!/usr/bin/env node

const fs = require("fs");

class helpers {
    static add_trailing_slash(path) {
        /*
        Adds a trailing slash to a path if it doesn't have one
        */
        let last_char = path.substr(path.length - 1);
        if (last_char != "/") {
            return path + "/";
        } else return path;
    }

    static get_course_image_url(course_data) {
        /*
        Constructs the course image filename using parts of the course short_url
        */
        let course_name_parts = course_data["short_url"].split("-");
        let image_name =
            course_name_parts[0] +
            "-" +
            course_name_parts[1] +
            course_name_parts[course_name_parts.length - 2].charAt(0) +
            course_name_parts[course_name_parts.length - 1].slice(2) +
            ".jpg";
        course_data["course_files"].forEach(media => {
            if (media["parent_uid"] == course_data["uid"]) {
                let file_location_parts = media["file_location"].split("/");
                let json_file = file_location_parts[file_location_parts.length - 1];
                let image_file = media["uid"] + "_" + image_name;
                if (json_file == image_file) {
                    return media["file_location"];
                }
            }
        });
        return "images/course_image.jpg";
    }

    static write_markdown_files(course_id, markdown_data, destination) {
        /*
        For a given course identifier string and array of objects with properties 
        name and data, write Hugo markdown files
        */
        if (destination && fs.lstatSync(destination).isDirectory()) {
            fs.mkdirSync(
                destination + course_id + "/sections", {
                    recursive: true
                },
                err => {
                    if (err) throw err;
                }
            );
            markdown_data.forEach(file => {
                let file_path = destination + course_id + "/" + file["name"];
                if (fs.existsSync(file_path)) {
                    fs.unlinkSync(file_path);
                }
                fs.writeFileSync(file_path, file["data"]);
            });
        }
    }
}

module.exports = helpers;