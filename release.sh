#!/usr/bin/env bash

set -u

newTag=${TAG:-""}
latestTag=$(git describe --tags 2> /dev/null)

tag=${newTag:-$latestTag}
tag=${tag:-"v0.0.0"}

major=$(echo $tag | awk -F. '{ print $1 }')
branch="releases/${major}"

set -e

# https://github.com/actions/toolkit/blob/master/docs/action-versioning.md#recommendations
git checkout -b ${branch}
rm -rf node_modules
gsed -i '/node_modules/d' .gitignore
npm install --production
git add node_modules .gitignore
git commit -m node_modules
git push origin -f ${branch}

if [ -n "$newTag" ]; then
  git tag $newTag
  git push --tags
fi

git checkout master
git branch -D ${branch}
