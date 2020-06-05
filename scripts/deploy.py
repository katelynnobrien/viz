"""
Makes it easy and painless to deploy the site and make all necessary changes
so that it's immediately ready to serve in production.
"""
import datetime
import glob
import os
import shlex
import subprocess
import sys

from colorama import Fore, Style

import data_util
import js_compilation


# Files and directories that should be deployed. Everything else will be ignored.
INCLUDE_LIST = [
    "about.html",
    "index.html",
    "c",
    "js/bundle.js",
    "css/styles.css",
]


# Returns True if everything we need is here, False otherwise.
def check_dependencies():
    try:
        subprocess.check_call(shlex.split("sass --version"),
                              stdout=subprocess.DEVNULL)
    except (subprocess.CalledProcessError, OSError):
        print("Please install 'sass' first.")
        return False
    # If the Closure compiler isn't available, let's get that setup.
    if not os.path.exists("tools/closure-compiler.jar"):
        print("The Closure compiler isn't available, fetching it. "
              "This will only happen once.")
        os.system("curl \"https://dl.google.com/closure-compiler/"
                  "compiler-latest.zip\" > compiler-latest.zip")
        if not os.path.exists("tools"):
            os.mkdir("tools")
        os.system("unzip -d tools compiler-latest.zip")
        os.system("mv tools/closure-compiler*.jar tools/closure-compiler.jar")
        os.system("rm -rf tools/COPYING tools/README.md")
        os.system("rm -f compiler-latest.zip")

    return True


def insert_analytics_code(quiet=False):
    main_page = ""
    with open("analytics.js") as f:
        code = f.read()
        f.close()
    inserted = False
    with open("index.html") as f:
        for line in f:
            if not inserted and "<script" in line:
                main_page += code
                inserted = True
            main_page += line
        f.close()

    # Remove the file and write a modified version
    os.system("rm index.html")
    with open("index.html", "w") as f:
        f.write(main_page)
        f.close()


def link_to_compiled_js_in_html(html_file):
    # Now link to the compiled code in the HTML file
    html = ""
    scripting_time = False
    with open(html_file) as f:
        for line in f:
            if line.strip() == "<!-- /js -->":
                scripting_time = False
                html += '<script src="/js/bundle.js"></script>\n'
            elif scripting_time:
                continue
            elif line.strip() == "<!-- js -->":
                scripting_time = True
            else:
                html += line
        f.close()

    # Remove the file and write a modified version
    os.system("rm " + html_file)
    with open(html_file, "w") as f:
        f.write(html)
        f.close()


def use_compiled_js(quiet=False):
    js_compilation.compile_js(quiet)
    link_to_compiled_js_in_html("index.html")
    link_to_compiled_js_in_html("country.html")


# Returns whether the operation was a success.
def backup_pristine_files():
    success = True
    success &= os.system("cp index.html index.html.orig") == 0
    success &= os.system("cp country.html country.html.orig") == 0
    return success


# Returns whether the operation was a success.
def restore_pristine_files():
    success = True
    success &= os.system("mv index.html.orig index.html") == 0
    success &= os.system("mv country.html.orig country.html") == 0
    return success


def copy_contents(target_path, quiet=False):
    success = True
    if not quiet:
        print("Copying new version into '" + target_path + "'...")
    # TODO: Use 'rsync' if it's available.
    success &= (os.system("rm -rf " + target_path + "/*") == 0)

    to_copy = []
    for f in INCLUDE_LIST:
        if "/" in f:
            parents = f.split("/")[:-1]
            for p in parents:
                if not os.path.exists(os.path.join(target_path, p)):
                    os.mkdir(os.path.join(target_path, p))
        to_copy.append([f, os.path.join(target_path, f)])

    for pair in to_copy:
        cmd = "cp -a " + pair[0] + " " + pair[1]
        if not quiet:
            print(cmd)
        success &= (os.system(cmd) == 0)

    return success


def deploy(target_path, quiet=False):
    if not check_dependencies():
        sys.exit(1)

    success = True
    success &= backup_pristine_files()
    success &= (os.system("sass css/styles.scss css/styles.css") == 0)

    use_compiled_js(quiet=quiet)
    insert_analytics_code(quiet=quiet)

    success &= data_util.make_country_pages()

    success &= copy_contents(target_path, quiet=quiet)
    success &= restore_pristine_files()

    if success:
        if not quiet:
            print(Fore.GREEN + "All done. " + Style.RESET_ALL + ""
                  "You can test it out with: "
                  "cd " + target_path + " && python3 -m http.server")
    else:
        print(Fore.RED + "Something went wrong." + Style.RESET_ALL)
