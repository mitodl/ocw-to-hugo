#!/usr/bin/env node

const yaml = require("js-yaml");
const markdown = require("markdown-builder");
const title_case = require("title-case");
const TurndownService = require("turndown");
const tables = require("turndown-plugin-gfm").tables;
const turndown_service = new TurndownService();
turndown_service.use(tables);
const helpers = require("./helpers");

class markdown_generators {
    static generate_course_home_front_matter(course_data) {
        /*
        Generate the front matter metadata for the course home page given course_data JSON
        */
        let front_matter = {};
        front_matter["title"] = "Course Home";
        front_matter["course_title"] = course_data["title"];
        front_matter["course_image_url"] = helpers.get_course_image_url(course_data);
        front_matter["course_description"] = course_data["description"];
        front_matter["course_info"] = {};
        front_matter["course_info"]["instructors"] = [];
        course_data["instructors"].forEach(instructor => {
            front_matter["course_info"]["instructors"].push(
                "Prof. " + instructor["first_name"] + " " + instructor["last_name"]
            );
        });
        front_matter["course_info"]["department"] = title_case.titleCase(
            course_data["url"].split("/")[2].replace(/-/g, " ")
        );
        front_matter["course_info"]["topics"] = [];
        course_data["course_collections"].forEach(feature => {
            let topic = "";
            if (feature["ocw_feature"]) {
                topic += feature["ocw_feature"];
            }
            if (feature["ocw_subfeature"]) {
                topic += " - " + feature["ocw_subfeature"];
            }
            front_matter["course_info"]["topics"].push(topic);
        });
        let course_number = course_data["sort_as"];
        if (course_data["extra_course_number"]) {
            if (course_data["extra_course_number"]["sort_as_col"]) {
                course_number +=
                    " / " + course_data["extra_course_number"]["sort_as_col"];
            }
        }
        front_matter["course_info"]["course_number"] = course_number;
        front_matter["course_info"]["term"] =
            course_data["from_semester"] + " " + course_data["from_year"];
        front_matter["course_info"]["level"] = course_data["course_level"];
        front_matter["menu"] = {};
        front_matter["menu"]["main"] = {};
        front_matter["menu"]["main"]["weight"] = -10;
        return "---\n" + yaml.safeDump(front_matter) + "---\n";
    }

    static generate_course_section_front_matter(title, menu_index) {
        /*
        Generate the front matter metadata for a course section given a title and menu index
        */
        let front_matter = {};
        front_matter["title"] = title;
        front_matter["menu"] = {};
        front_matter["menu"]["main"] = {};
        front_matter["menu"]["main"]["weight"] = menu_index;
        return "---\n" + yaml.safeDump(front_matter) + "---\n";
    }

    static generate_course_features(course_data) {
        /*
        Generate markdown for the "Course Features" section of the home page
        */
        let course_features_markdown = markdown.headers.hX(5, "Course Features");
        let course_features = [];
        course_data["course_features"].forEach(course_feature => {
            let url = course_feature["ocw_feature_url"]
                .replace("/index.htm", "/")
                .split("/")[-1];
            course_features.push(
                markdown.misc.link(course_feature["ocw_feature"], url)
            );
        });
        course_features_markdown += "\n" + markdown.lists.ul(course_features);
        return course_features_markdown;
    }

    static generate_course_collections(course_data) {
        /*
        Generate markdown for the "Course Collections" section of the home page
        */
        let course_collections_markdown = markdown.headers.hX(
            5,
            "Course Collections"
        );
        course_collections_markdown +=
            "\nSee related courses in the following collections:\n";
        course_collections_markdown +=
            "\n" + markdown.emphasis.i("Find Courses by Topic") + "\n\n";
        let course_collections = [];
        course_data["course_collections"].forEach(course_collection => {
            let feature = course_collection["ocw_feature"];
            let subfeature = course_collection["ocw_subfeature"];
            let specialty = course_collection["ocw_specialty"];
            let collection = feature;
            if (subfeature) {
                collection += " > " + subfeature;
            }
            if (specialty) {
                collection += " > " + specialty;
            }
            course_collections.push(markdown.misc.link(collection, "#"));
        });
        course_collections_markdown += markdown.lists.ul(course_collections);
        return course_collections_markdown;
    }

    static generate_course_section_markdown(page, course_data) {
        /*
        Generate markdown a given course section page
        */
        let html_str = page["text"];
        course_data["course_pages"].forEach(course_page => {
            let placeholder = "./resolveuid/" + course_page["uid"];
            let page_name = course_page["short_url"].replace(".html", "");
            if (html_str.indexOf(placeholder) > -1) {
                html_str = html_str.replace(placeholder, "/sections/" + page_name);
            }
        });
        course_data["course_files"].forEach(media => {
            let placeholder = "./resolveuid/" + media["uid"];
            if (html_str.indexOf(placeholder) > -1) {
                // TODO: Add option to change links to media to be at root of site for static copy
            }
        });
        try {
            return turndown_service.turndown(html_str);
        } catch (err) {
            return html_str;
        }
    }
}

module.exports = markdown_generators;