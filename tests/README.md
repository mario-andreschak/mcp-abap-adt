# Tests Directory

This directory contains test scripts for the MCP ABAP ADT server functionality.

## Test Categories

### Enhancement Tests
- `test-enhancement-by-name.js` - Test getting enhancements by specific name
- `test-enhancement-timeout.js` - Test enhancement timeout handling
- `test-enhancement-timeout-optimized.js` - Optimized enhancement timeout tests
- `test-get-enhancements.js` - General enhancement retrieval tests
- `test-rm07docs-enhancements.js` - Comprehensive RM07DOCS enhancement tests
- `test-rm07docs-fast.js` - Fast timeout tests for RM07DOCS

### Include Tests
- `test-get-includes-list.js` - Test include list retrieval
- `test-includes-list-timeout.js` - Test include list timeout handling

### Program Tests
- `test-get-program.js` - Test program retrieval
- `test-sapmv45a-large-program.js` - Test large program handling (SAPMV45A)
- `test-sapmv45a-large-program-fixed.js` - Fixed version of large program test

### Object Structure Tests
- `test-node-structure.js` - Test SAP node structure API
- `test-related-objects.js` - Test related objects functionality
- `test-simplified-related-types.js` - Simplified related types test

### Infrastructure Tests
- `test-csrf.js` - Test CSRF token handling
- `test-list-tools.js` - Test MCP tools listing
- `test-stdio.js` - Test STDIO communication
- `test-simple-timeout.js` - Simple timeout functionality test
- `test-two-step-approach.js` - Test two-step processing approach

## Running Tests

### Individual Tests
```bash
# Run specific test
node tests/test-rm07docs-fast.js

# Run enhancement tests
node tests/test-get-enhancements.js
node tests/test-rm07docs-enhancements.js

# Run include tests
node tests/test-get-includes-list.js
node tests/test-includes-list-timeout.js
```

### Quick Performance Tests
```bash
# Fast RM07DOCS tests (recommended for development)
node tests/test-rm07docs-fast.js

# Comprehensive RM07DOCS tests
node tests/test-rm07docs-enhancements.js

# Large program tests (SAPMV45A)
node tests/test-sapmv45a-large-program-fixed.js
```

## Test Requirements

All tests require:
1. **Environment file**: `.env` file in the project root with SAP connection details
2. **Built server**: Run `npm run build` before testing
3. **SAP system access**: Valid SAP credentials and accessible SAP system

## Environment Setup

Create `.env` file in project root:
```env
SAP_BASE_URL=https://your-sap-system.com:port
SAP_USERNAME=your-username
SAP_PASSWORD=your-password
SAP_CLIENT=100
```

## Test Results Interpretation

### Success Indicators
- ✅ **Success messages** with timing information
- 📊 **Object counts** (objects analyzed, enhancements found)
- ⏱️ **Performance metrics** (duration in milliseconds)

### Failure Indicators
- ❌ **Error messages** with specific error details
- 🚨 **Timeout warnings** indicating performance issues
- ⚠️ **Partial results** when some operations fail

### Performance Benchmarks

**RM07DOCS (Small Program):**
- Without nested: ~1-2 seconds
- With nested: ~6-7 seconds

**SAPMV45A (Large Program):**
- Without nested: ~3-5 seconds
- With nested: ~15-30 seconds (depending on timeout)

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check `.env` file configuration
   - Verify SAP system accessibility
   - Confirm credentials are correct

2. **Timeout Errors**
   - Increase timeout values in test parameters
   - Check network connectivity
   - Consider using non-nested mode for faster results

3. **Authentication Errors**
   - Verify username/password in `.env`
   - Check if account is locked
   - Confirm client number is correct

### Debug Mode

Add debug logging by setting environment variable:
```bash
DEBUG=1 node tests/test-name.js
```

## Contributing

When adding new tests:
1. Follow naming convention: `test-feature-name.js`
2. Include comprehensive error handling
3. Add timeout controls for long-running operations
4. Document expected results and performance benchmarks
5. Update this README with test description
