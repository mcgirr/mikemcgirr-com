MAKEFLAGS = -s

.PHONY: build clean server help deploy

.DEFAULT_GOAL = help

## Show help screen.
help:
	@echo "Please use \`make <target>' where <target> is one of\n\n"
	@awk '/^[a-zA-Z\-\_0-9]+:/ { \
		helpMessage = match(lastLine, /^## (.*)/); \
		if (helpMessage) { \
			helpCommand = substr($$1, 0, index($$1, ":")-1); \
			helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
			printf "%-30s %s\n", helpCommand, helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)

## Build the site
build:
	zola build

## Clean the public directory
clean:
	rm -rf public

## Start the development server
server:
	zola serve

## Rebuild the site from scratch
rebuild: clean build

## Deploy the site using deploy.sh script
deploy: build
	./deploy.sh

## Deploy with verbose output
deploy-verbose: build
	./deploy.sh --verbose

## Perform a dry run deployment (no actual changes)
deploy-dry-run: build
	./deploy.sh --dry-run --verbose
