PYTHON ?= python3
PYDIST := pydist

.PHONY: dev build-web build-python release clean

dev:
	npm run dev

build-web:
	npm run build

# sdist/wheel bundle dist/ (see pyproject.toml's force-include), so the web
# app must be built first.
build-python: build-web
	$(PYTHON) -m build --outdir $(PYDIST)

# clean first so $(PYDIST) holds only this version's sdist/wheel — twine
# would otherwise also re-upload any stale build left over from before,
# which PyPI rejects (versions are immutable). Needs `pip install twine`
# and PyPI credentials (~/.pypirc or TWINE_USERNAME/TWINE_PASSWORD).
release: clean build-python
	$(PYTHON) -m twine upload $(PYDIST)/*

clean:
	rm -rf dist $(PYDIST)
