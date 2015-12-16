#!/bin/sh

cd /app
node_modules/.bin/forever --minUptime 2000 --spinSleepTime 2000 src/index.js
