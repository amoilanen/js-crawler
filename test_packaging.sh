#!/bin/bash

# This script can be used to test that a package for js-crawler is built and installed properly and can be used when imported
#
# - builds the package for js-crawler
# - installs it as a dependency of js-crawler-examples
# - runs phantomjs_wiki.js

echo "Removing old versions of the package"
rm *.tgz

echo "Creating new package"
npm pack

echo "Installing created package for examples"
package_file=$(ls js-crawler*.tgz)
rm -rf examples/node_modules

cd examples
npm install ../$package_file
rm ../$package_file

echo "Running phantomjs_wiki.js example script"
node phantomjs_wiki.js