# ANTLR4 Configuration
ANTLR_VERSION = 4.13.1
ANTLR_JAR = antlr-$(ANTLR_VERSION)-complete.jar
ANTLR_URL = https://www.antlr.org/download/$(ANTLR_JAR)
ANTLR_DIR = tools/antlr
GRAMMAR_FILE = Abap.g4
GENERATED_DIR = src/generated
PARSER_PACKAGE = abap

# Default target
.PHONY: all
all: setup generate build

# Setup ANTLR4
.PHONY: setup
setup: $(ANTLR_DIR)/$(ANTLR_JAR)

$(ANTLR_DIR)/$(ANTLR_JAR):
	@echo "Downloading ANTLR4 JAR..."
	@mkdir -p $(ANTLR_DIR)
	@curl -L $(ANTLR_URL) -o $(ANTLR_DIR)/$(ANTLR_JAR)
	@echo "ANTLR4 JAR downloaded successfully"

# Generate parser from grammar
.PHONY: generate
generate: $(ANTLR_DIR)/$(ANTLR_JAR)
	@echo "Generating ANTLR4 parser..."
	@mkdir -p $(GENERATED_DIR)
	@java -jar $(ANTLR_DIR)/$(ANTLR_JAR) -Dlanguage=TypeScript -o $(GENERATED_DIR) -package $(PARSER_PACKAGE) $(GRAMMAR_FILE)
	@echo "Parser generated successfully"

# Build TypeScript
.PHONY: build
build:
	@echo "Building TypeScript..."
	@npm run build
	@echo "Build completed"

# Clean generated files
.PHONY: clean
clean:
	@echo "Cleaning generated files..."
	@rm -rf $(GENERATED_DIR)
	@rm -rf dist/
	@echo "Clean completed"

# Clean everything including ANTLR JAR
.PHONY: clean-all
clean-all: clean
	@echo "Cleaning ANTLR JAR..."
	@rm -rf $(ANTLR_DIR)
	@echo "Clean all completed"

# Development workflow
.PHONY: dev
dev: generate build
	@npm run dev

# Test
.PHONY: test
test: generate build
	@npm test

# Install dependencies
.PHONY: install
install:
	@npm install

# Help
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  all        - Setup ANTLR, generate parser, and build"
	@echo "  setup      - Download ANTLR4 JAR"
	@echo "  generate   - Generate parser from grammar"
	@echo "  build      - Build TypeScript"
	@echo "  clean      - Clean generated files"
	@echo "  clean-all  - Clean everything including ANTLR JAR"
	@echo "  dev        - Generate, build and run in development mode"
	@echo "  test       - Generate, build and run tests"
	@echo "  install    - Install npm dependencies"
	@echo "  help       - Show this help"
