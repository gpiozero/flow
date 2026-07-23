PYTHON ?= python3
PYDIST := pydist

.PHONY: dev build-web build-python clean

dev:
	npm run dev

build-web:
	npm run build

# sdist/wheel bundle dist/ (see pyproject.toml's force-include), so the web
# app must be built first.
build-python: build-web
	$(PYTHON) -m build --outdir $(PYDIST)

clean:
	rm -rf dist $(PYDIST)
