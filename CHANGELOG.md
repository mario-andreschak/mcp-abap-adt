# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Optional HTTP transport mode for MCP using `StreamableHTTPServerTransport`.
- New HTTP endpoints:
  - `/mcp` for MCP requests (GET/POST/DELETE)
  - `/healthz` for container and Kubernetes health probes
- New `GetCDSView` tool to retrieve CDS view (DDL source) source code.

### Changed
- `GetTableContents` now uses the standard ADT data preview endpoint
  (`/sap/bc/adt/datapreview/freestyle`) instead of a custom Z-service, so it
  works on any system without extra development. The table name is validated
  before use.
- `sap-client` is now sent as a query parameter on every ADT request; the
  `X-SAP-Client` header alone is ignored by ICF, which caused requests to run
  in the system default client.
- Docker defaults now use HTTP transport with `MCP_TRANSPORT=http` and `PORT=8080`.
- Docker health check now probes `/healthz` instead of checking process state.
- Docker image now exposes port `8080`.
- Replaced `npm install -r` with `npm install` in Docker build.
- Raised dependency floors (`@modelcontextprotocol/sdk` `^1.29.0`, `axios`
  `^1.18.1`) and committed `package-lock.json` for reproducible installs.

## [1.1.0] - 2025-02-19

### Added
- New `GetTransaction` tool to retrieve ABAP transaction details.
  - Allows fetching transaction details using the ADT endpoint `/sap/bc/adt/repository/informationsystem/objectproperties/values`.
  - Added documentation in README.md.

## [0.1.2] - 2025-02-18

### Changed
- Added Jest Test Script `index.test.ts` available through `npm test`
- Enhanced `makeAdtRequest` method to support:
  - Custom headers through an optional parameter
  - Query parameters through an optional `params` parameter
- Improved `handleGetPackage` method to use ADT's nodeContent API
  - Now uses POST request with proper XML payload
  - Added specific content type headers for nodeContent endpoint
  - Added filtering to return only objects with URI 
- Improved CSRF token handling in utils.ts
  - Added automatic CSRF token fetching for POST/PUT requests
  - Enhanced token extraction to work with error responses
  - Added cookie management for better session handling
  - Implemented singleton axios instance for consistent state
  - Added proper cleanup for test environments

## [0.1.1] - 2025-02-13

### Added
- New `GetInterface` tool to retrieve ABAP interface source code
  - Allows fetching source code of ABAP interfaces using the ADT endpoint `/sap/bc/adt/oo/interfaces/`
  - Similar functionality to GetClass but for interfaces
  - Added documentation in README.md

## [0.1.0] - Initial Release

### Added
- Initial release of the MCP ABAP ADT server
- Basic ABAP object retrieval functionality
- Support for programs, classes, function modules, and more
- Documentation and setup instructions
