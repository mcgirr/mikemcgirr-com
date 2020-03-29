MAKEFLAGS = -s

.PHONY: build site-build site-clean site-rebuild site-watch

.DEFAULT_GOAL = help

require-%:
	if [ "${${*}}" = "" ]; then \
	        echo "ERROR: Environment variable not set: \"$*\""; \
	        exit 1; \
	fi

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


## Build the Hakyll Haskell project itself
build:
	stack build

# These commands for Hakyll documented here: https://jaspervdj.be/hakyll/tutorials/02-basics.html
# NOTE: In general, you want to use `stack exec site build` when you just made changes to the contents of your website.

## Initial Hakyll site build. This creates _site (where the goodies are) and _cache
site-build:
	stack exec site build

## removes the _site and _cache directories
site-clean:
	stack exec site clean

## Performs a Hakyll clean and then a Hakyll build
site-rebuild:
	stack exec site rebuild

## If you installed hakyll with a preview server (this is the default), you can use this and have a look at your site at http://localhost:8000/.

## Watch for change and rebuild
site-watch:
	stack exec site watch

# TODO this might need a script to help it (like deploy.zsh used to do)
## A rule that uploads _site to the correct location on the server (using scp and the correct SSH key relative to this project). and then remotely reloads nginx
# upload:

# TODO
# publish:
# Add a rule that runs the build rule, then the site-build rule, then the upload rule

# TODO (?)

# clean:

# destroy:
