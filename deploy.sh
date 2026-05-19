#!/bin/sh
set -eu

BRANCH="${DEPLOY_BRANCH:-main}"

echo "Deploy macOS e Windows"

if [ -z "${GH_TOKEN:-}" ]; then
    echo "Erro: defina a variavel GH_TOKEN antes de publicar no GitHub."
    echo "Exemplo: export GH_TOKEN=seu_token"
    exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add -A
    git commit -m "Prepare release"
fi

npm version patch -m "Bump version to %s"
git push origin "$BRANCH" --follow-tags

rm -rf ./build
npm run deploy

echo "Deploy finalizado"
