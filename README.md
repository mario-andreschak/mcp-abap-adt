# MCP ABAP ADT Server

[![smithery badge](https://smithery.ai/badge/@orchestraight.co/mcp-abap-adt)](https://smithery.ai/server/@orchestraight.co/mcp-abap-adt)

A Model Context Protocol (MCP) server that provides seamless integration with SAP ABAP Development Tools (ADT). This server enables AI assistants and development tools to interact with SAP ABAP systems, retrieve source code, analyze structures, and perform various ABAP development tasks.

## 🌟 Features

- **Complete ABAP Object Access**: Retrieve source code for programs, classes, interfaces, function modules, and more
- **Database Integration**: Access table structures and contents
- **Search Capabilities**: Find ABAP objects using pattern matching
- **Where-Used Analysis**: Track object dependencies and usage
- **Package Management**: Browse ABAP packages and their contents
- **Transaction Support**: Access transaction details and metadata
- **CDS View Support**: Work with Core Data Services views

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Available Tools](#available-tools)
6. [Integration with MCP Clients](#integration-with-mcp-clients)
7. [Development](#development)
8. [Troubleshooting](#troubleshooting)
9. [Contributing](#contributing)
10. [License](#license)
11. [Support](#support)
12. [Changelog](#changelog)

## Prerequisites

Before using this MCP server, ensure you have:

### SAP System Requirements
- **SAP ABAP System**: Access to a running SAP system with ADT enabled
- **User Credentials**: Valid SAP username and password
- **Client Number**: SAP client (e.g., `100`)
- **ADT Services**: Ensure `/sap/bc/adt` services are activated in transaction `SICF`
- **Custom Service** (Optional): For `GetTableContents`, implement custom service `/z_mcp_abap_adt/z_tablecontent`

### Development Environment
- **Node.js**: Version 16 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: Included with Node.js
- **Git**: For cloning the repository ([Download Git](https://git-scm.com/))

## Installation

### Option 1: Smithery (Recommended)

Install automatically via [Smithery](https://smithery.ai/server/@orchestraight.co/mcp-abap-adt):

```bash
npx -y @smithery/cli install @orchestraight.co/mcp-abap-adt --client cline
```

### Option 2: Manual Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mario-andreschak/mcp-abap-adt.git
   cd mcp-abap-adt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with your SAP system credentials:

```env
SAP_URL=https://your-sap-system.com:8000
SAP_USERNAME=your_username
SAP_PASSWORD="your_password"  # Use quotes if password contains special characters like #
SAP_CLIENT=100
```

**Security Note**: Never commit the `.env` file to version control. Add it to your `.gitignore` file.

### SSL Certificate Issues

If you encounter SSL certificate issues with self-signed certificates, you can disable certificate validation by setting:

```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**Warning**: Only use this in development environments, never in production.

## Usage

### Running the Server

#### Standalone Mode
```bash
npm run start
```
Runs the server directly. Primarily used when integrated with MCP clients.

#### Development Mode (with Inspector)
```bash
npm run dev
```
Starts the server with the MCP Inspector for debugging and testing. Access the inspector at the URL displayed in the terminal output.

#### Testing
```bash
npm test
```
Runs the test suite to verify functionality.

### Verification

To verify the server is working correctly:

1. Start the server in development mode
2. Open the MCP Inspector URL in your browser
3. Click "Connect" to establish connection
4. Navigate to "Tools" and test a tool like `GetProgram` with a program name like `SAPMV45A`

## Integration with MCP Clients

### Cline VS Code Extension

1. **Install Cline Extension** in VS Code
2. **Configure MCP Settings**:
   - Open VS Code settings (Ctrl+,)
   - Search for "Cline MCP Settings"
   - Edit `cline_mcp_settings.json`
   - Add server configuration:

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "command": "node",
      "args": ["C:/PATH_TO/mcp-abap-adt/dist/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

3. **Restart VS Code** to load the configuration
4. **Test Integration** by asking Cline to retrieve ABAP source code

### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "command": "node",
      "args": ["C:/PATH_TO/mcp-abap-adt/dist/index.js"],
      "env": {
        "SAP_URL": "your_sap_url",
        "SAP_USERNAME": "your_username", 
        "SAP_PASSWORD": "your_password",
        "SAP_CLIENT": "your_client"
      }
    }
  }
}
```

## Development

### Project Structure

```
src/
├── index.ts              # Main server entry point
├── handlers/             # Tool implementations
│   ├── handleGetProgram.ts
│   ├── handleGetClass.ts
│   ├── handleGetFunction.ts
│   └── ... (other handlers)
└── lib/
    └── utils.ts          # Shared utilities
```

### Building and Testing

```bash
# Build TypeScript to JavaScript
npm run build

# Run tests
npm test

# Development with hot reload
npm run dev
```

### Adding New Tools

1. Create handler in `src/handlers/`
2. Add tool definition to `index.ts`
3. Implement tool logic following existing patterns
4. Add tests for the new functionality

## Available Tools

This MCP server provides comprehensive access to ABAP development objects:

| Tool | Description | Parameters | Example |
|------|-------------|------------|---------|
| **GetProgram** | Retrieve ABAP program source code | `program_name` (string): Program name | `GetProgram program_name=ZMY_PROGRAM` |
| **GetClass** | Retrieve ABAP class source code | `class_name` (string): Class name | `GetClass class_name=ZCL_MY_CLASS` |
| **GetInterface** | Retrieve ABAP interface source code | `interface_name` (string): Interface name | `GetInterface interface_name=ZIF_MY_INTERFACE` |
| **GetFunction** | Retrieve function module source code | `function_name` (string): Function name<br>`function_group` (string): Function group | `GetFunction function_name=ZMY_FUNCTION function_group=ZFG` |
| **GetFunctionGroup** | Retrieve function group source code | `function_group` (string): Function group name | `GetFunctionGroup function_group=ZMY_FUNCTION_GROUP` |
| **GetTable** | Retrieve database table structure | `table_name` (string): Table name | `GetTable table_name=ZMY_TABLE` |
| **GetTableContents** | Retrieve table data | `table_name` (string): Table name<br>`max_rows` (number, optional): Max rows (default: 100) | `GetTableContents table_name=ZMY_TABLE max_rows=50` |
| **GetStructure** | Retrieve DDIC structure definition | `structure_name` (string): Structure name | `GetStructure structure_name=ZMY_STRUCT` |
| **GetCds** | Retrieve CDS view source code | `cds_name` (string): CDS view name | `GetCds cds_name=ZI_MY_CDS_VIEW` |
| **GetPackage** | Retrieve package details | `package_name` (string): Package name | `GetPackage package_name=ZMY_PACKAGE` |
| **GetInclude** | Retrieve include source code | `include_name` (string): Include name | `GetInclude include_name=ZMY_INCLUDE` |
| **GetTransaction** | Retrieve transaction details | `transaction_name` (string): Transaction code | `GetTransaction transaction_name=ZMY_TRANSACTION` |
| **GetTypeInfo** | Retrieve ABAP type information | `type_name` (string): Type name | `GetTypeInfo type_name=ZMY_TYPE` |
| **GetWhereUsed** | Find where object is used | `object_name` (string): Object name<br>`object_type` (string, optional): Object type<br>`max_results` (number, optional): Max results (default: 100) | `GetWhereUsed object_name=ZCL_MY_CLASS object_type=CLASS` |
| **SearchObject** | Search for ABAP objects | `query` (string): Search pattern<br>`maxResults` (number, optional): Max results (default: 100) | `SearchObject query=ZMY* maxResults=20` |

### Object Types for GetWhereUsed
- `CLASS` - ABAP Classes
- `INTERFACE` - ABAP Interfaces  
- `PROGRAM` - ABAP Programs/Reports
- `FUNCTION` - Function Modules
- `TABLE` - Database Tables
- `STRUCTURE` - DDIC Structures

## Troubleshooting

### Common Issues

#### Node.js Installation Issues
- **Problem**: `node -v` or `npm -v` command not found
- **Solution**: 
  - Reinstall Node.js from [nodejs.org](https://nodejs.org/)
  - Ensure Node.js is added to system PATH
  - Restart terminal/command prompt

#### Build/Installation Issues
- **Problem**: `npm install` fails
- **Solutions**:
  - Check internet connection
  - Clear npm cache: `npm cache clean --force`
  - Delete `node_modules` and `package-lock.json`, then retry
  - Check proxy settings if behind corporate firewall

#### SAP Connection Issues
- **Problem**: Authentication failures
- **Solutions**:
  - Verify credentials in `.env` file
  - Ensure SAP user has ADT authorization
  - Check SAP system accessibility
  - Verify ADT services are active in `SICF`

#### SSL/Certificate Issues
- **Problem**: SSL certificate errors
- **Solutions**:
  - For development: Set `NODE_TLS_REJECT_UNAUTHORIZED=0`
  - For production: Install proper certificates
  - Check with your SAP administrator

#### MCP Client Integration Issues
- **Problem**: Client doesn't recognize server
- **Solutions**:
  - Verify absolute paths in configuration
  - Ensure server is built (`npm run build`)
  - Restart MCP client
  - Check configuration file syntax

### Debug Mode Testing

To test the server manually:

```bash
# Build the project
npm run build

# Start with inspector
npm run dev

# Test in browser
# 1. Open the inspector URL
# 2. Click "Connect"
# 3. Go to "Tools" tab
# 4. Test GetProgram with "SAPMV45A"
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new functionality
5. Run tests: `npm test`
6. Build project: `npm run build`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/mario-andreschak/mcp-abap-adt/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mario-andreschak/mcp-abap-adt/discussions)
- **Smithery**: [@orchestraight.co/mcp-abap-adt](https://smithery.ai/server/@orchestraight.co/mcp-abap-adt)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

---

**Note**: This server is designed for development and testing purposes. Always follow your organization's security policies when connecting to SAP systems.