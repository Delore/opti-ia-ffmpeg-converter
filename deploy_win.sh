#!/bin/sh
echo "Build and Deploy for Win"
git add . 
git commit -m "Build and Deploy for Win"
git push origin main
npm version patch
git add . 
git commit -m "Bumb version"
git push origin main

rm -R ./build
npm run deploy
echo "Finish"