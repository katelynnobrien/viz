import os

DEBUG = False

def compile_js(quiet=False):

    if not quiet:
        print("Compiling Javascript...")

    cmd = (
        "java -jar tools/closure-compiler.jar "
        "--language_in ECMASCRIPT6 "
        "--compilation_level ADVANCED_OPTIMIZATIONS "
        "" + ("--formatting=pretty_print " if DEBUG else "") + ""
        "--js js/completeness.js "
        "--js js/country.js "
        "--js js/dataprovider.js "
        "--js js/diseasemap.js "
        "--js js/graphing.js "
        "--js js/timeanimation.js "
        "--js js/healthmap.js "
        "--js js/rank.js "
        "--externs js/externs_chart.js "
        "--externs js/externs_mapbox.js "
        "--js_output_file js/bundle.js"
    )
    if quiet:
        cmd += " 2> /dev/null"
    os.system(cmd)


if __name__ == "__main__":
    compile_js()
