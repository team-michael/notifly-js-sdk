# Please make sure that you're in the root directory of the project (/notifly-js-sdk)
# Please make sure that package name is same as the packed tar.gz file!

# Common
rm -rf .parcel-cache *.tgz dist
npm run build && npm pack
npm run --prefix ${PWD}/example-react clean && npm --prefix ${PWD}/example-react install

if [ "$1" = "--prod" ]; then
    # Production
    npm run --prefix ${PWD}/example-react build && npm run --prefix ${PWD}/example-react start-prod
else
    # Development
    npm run --prefix ${PWD}/example-react start
fi
