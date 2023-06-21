# Please make sure that you're in the root directory of the project (/notifly-js-sdk)
# Please make sure that package name is same as the packed tar.gz file!

npm run build && npm pack
npm run --prefix ${PWD}/example-react clean && npm --prefix ${PWD}/example-react install && npm run --prefix ${PWD}/example-react start
