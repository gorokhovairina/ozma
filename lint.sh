#!/bin/sh -e
# Lint the application.

. ./prepare.sh
yarn lint --no-fix --max-warnings 0
yarn lint:style --no-fix --max-warnings 0
