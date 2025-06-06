# MCP ABAP ADT Server Installation Guide

This guide will help you install and configure the MCP ABAP ADT Server for working with SAP ABAP systems through the Model Context Protocol (MCP). The server allows integration of ABAP development with AI tools like Cline, Cursor, and GitHub Copilot.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration for On-Premise SAP](#configuration-for-on-premise-sap)
4. [Configuration for SAP BTP Cloud](#configuration-for-sap-btp-cloud)
5. [Connecting to Cline](#connecting-to-cline)
6. [Connecting to Cursor](#connecting-to-cursor)
7. [Connecting to GitHub Copilot](#connecting-to-github-copilot)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Available Tools](#available-tools)

## 🔧 Prerequisites

### System Requirements
- **Node.js** version 18 or newer
- **npm** (installed with Node.js)
- **Git** for repository cloning
- Access to SAP ABAP system (on-premise or BTP)

### SAP System Requirements
- Activated ADT services in transaction `SICF`:
  - `/sap/bc/adt`
- For `GetTableContents` tool, custom service implementation `/z_mcp_abap_adt/z_tablecontent` is required
- Appropriate authorizations for SAP user

### Installing Node.js
1. Download Node.js LTS version from [nodejs.org](https://nodejs.org/)
2. Install following instructions for your OS
3. Verify installation:
   ```bash
   node -v
   npm -v
   ```

## 📦 Installation

### Automatic Installation via Smithery

```bash
npx -y @smithery/cli install @mario-andreschak/mcp-abap-adt --client cline
```

### Manual Installation

1. **Clone repository:**
   ```bash
   git clone https://github.com/mario-andreschak/mcp-abap-adt.git
   cd mcp-abap-adt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build project:**
   ```bash
   npm run build
   ```

## 🏢 Configuration for On-Premise SAP

### 1. Create Configuration File

Create `.env` file in the project root directory:

```env
# Your SAP system URL
SAP_URL=https://your-sap-system.com:8000

# SAP client
SAP_CLIENT=100

# Language (optional, default is 'en')
SAP_LANGUAGE=en

# Authorization type
SAP_AUTH_TYPE=basic

# Credentials
SAP_USERNAME=your_username
SAP_PASSWORD=your_password

# TLS settings (set to 0 for self-signed certificates)
TLS_REJECT_UNAUTHORIZED=0

# Timeout configuration (in milliseconds)
SAP_TIMEOUT_DEFAULT=45000
SAP_TIMEOUT_CSRF=15000
SAP_TIMEOUT_LONG=60000
```

### 2. Test Connection

Run test connection:
```bash
npm run start
```

## ☁️ Configuration for SAP BTP Cloud

### 1. Obtain Service Key

1. Log into SAP BTP Cockpit
2. Navigate to your ABAP Environment
3. Create Service Key for Communication Arrangement
4. Download JSON file with the key

### 2. Automatic Authorization (Recommended)

Use the built-in tool for automatic JWT token retrieval:

```bash
node tools/sap-abap-auth-browser.js auth --key path/to/your/service-key.json --browser chrome
```

**Parameters:**
- `--key <path>`: Path to JSON file with service key
- `--browser <browser>`: Browser to open (chrome, edge, firefox, system, none)

**What the tool does:**
1. Reads your SAP BTP service key
2. Opens browser for OAuth2 authorization
3. Automatically exchanges authorization code for JWT token
4. Creates/updates `.env` file with correct configuration

### 3. Manual Configuration

If automatic authorization doesn't work, create `.env` file manually:

```env
# URL from service key
SAP_URL=https://your-account-abap-trial.eu10.abap.cloud.sap

# SAP client from service key
SAP_CLIENT=100

# Authorization type
SAP_AUTH_TYPE=xsuaa

# JWT token (obtain through OAuth2 flow)
SAP_JWT_TOKEN=your_jwt_token_here

# Timeout configuration
SAP_TIMEOUT_DEFAULT=45000
SAP_TIMEOUT_CSRF=15000
SAP_TIMEOUT_LONG=60000
```

## 🔌 Connecting to Cline

### 1. Install Cline

Install "Cline" extension in VS Code from Marketplace.

### 2. Configure MCP Server

1. Open VS Code settings (Ctrl+,)
2. Search for "Cline MCP Settings"
3. Click "Edit in settings.json"
4. Add server configuration:

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

**Important:** Replace `C:/PATH_TO/mcp-abap-adt/` with the full path to your project directory.

### 3. Restart VS Code

Restart VS Code to apply settings.

## 🎯 Connecting to Cursor

### 1. Install Cursor

Download and install Cursor from [cursor.sh](https://cursor.sh/).

### 2. Configure MCP

1. Open Cursor
2. Go to Settings → Features → Model Context Protocol
3. Add new server:

```json
{
  "mcp-abap-adt": {
    "command": "node",
    "args": ["C:/PATH_TO/mcp-abap-adt/dist/index.js"],
    "env": {}
  }
}
```

### 3. Activate Server

Enable server in MCP settings and restart Cursor.

## 🐙 Connecting to GitHub Copilot

### 1. GitHub Copilot Extensions

GitHub Copilot supports MCP through extensions. For integration:

1. Install GitHub Copilot Extension for VS Code
2. Configure MCP server through extension configuration
3. Add to `settings.json`:

```json
{
  "github.copilot.advanced": {
    "mcp": {
      "servers": {
        "mcp-abap-adt": {
          "command": "node",
          "args": ["C:/PATH_TO/mcp-abap-adt/dist/index.js"]
        }
      }
    }
  }
}
```

### 2. Using via Claude Desktop

Alternatively, use Claude Desktop as intermediate tool:

1. Install Claude Desktop
2. Configure MCP server in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "command": "node",
      "args": ["C:/PATH_TO/mcp-abap-adt/dist/index.js"]
    }
  }
}
```

## 🧪 Testing

### 1. Test Connection

Run server in debug mode:
```bash
npm run dev
```

Open browser at the address shown by the command (usually `http://localhost:5173`).

### 2. Test Tools

In MCP Inspector:
1. Click "Connect"
2. Go to "Tools"
3. Click "List Tools"
4. Try `GetProgram` tool with parameter `SAPMV45A`

### 3. Test in Cline

Ask Cline:
```
Get source code of program SAPMV45A
```

Cline should use the MCP server to retrieve the code.

## 🔧 Troubleshooting

### Node.js Issues
- **Error "node not recognized"**: Make sure Node.js is added to PATH
- **npm install error**: Try deleting `node_modules` and run `npm install` again

### SAP Connection Issues
- **Authorization error**: Check credentials in `.env` file
- **Timeout**: Increase timeout values in `.env`
- **SSL errors**: Set `TLS_REJECT_UNAUTHORIZED=0` for self-signed certificates

### MCP Client Issues
- **Cline doesn't see server**: Check path in `cline_mcp_settings.json`
- **Server doesn't start**: Make sure project is built (`npm run build`)

### Logging and Debugging

For detailed logging set environment variable:
```bash
set DEBUG=mcp-abap-adt:*
npm run start
```

## 📚 Available Tools

| Tool | Description | Parameters | Usage Example |
|------|-------------|------------|---------------|
| `GetProgram` | Get ABAP program source code | `program_name` (string) | Get code of program SAPMV45A |
| `GetClass` | Get ABAP class source code | `class_name` (string) | Show class ZCL_MY_CLASS |
| `GetFunction` | Get function module code | `function_name`, `function_group` | Get function Z_MY_FUNCTION |
| `GetTable` | Database table structure | `table_name` (string) | Show structure of table MARA |
| `GetTableContents` | Database table contents | `table_name`, `max_rows` (optional) | Get data from table MARA |
| `GetEnhancements` | Enhancement analysis | `object_name`, `include_nested` (optional) | Find all enhancements in SAPMV45A |
| `GetSqlQuery` | Execute SQL queries | `sql_query`, `row_number` (optional) | Execute SELECT * FROM mara WHERE matnr LIKE 'TEST%' |
| `SearchObject` | Search ABAP objects | `query`, `maxResults` (optional) | Find all objects starting with Z* |

### Usage Examples in Cline

```
# Get program
Get source code of program SAPMV45A

# Enhancement analysis
Find all enhancements in program SAPMV45A including nested includes

# Object search
Find all classes starting with ZCL_SALES

# SQL query
Execute SQL query: SELECT matnr, maktx FROM mara INNER JOIN makt ON mara~matnr = makt~matnr WHERE mara~matnr LIKE 'TEST%'
```

## 🔐 Security

### Credential Protection
- Never add `.env` file to Git repository
- Use JWT tokens instead of passwords for BTP
- Regularly update access tokens

### Network Security
- Use HTTPS for all connections
- Configure firewall rules to restrict access
- Monitor access logs

## 📞 Support

When encountering issues:
1. Check server logs
2. Review SAP ADT documentation
3. Create issue in GitHub repository
4. Contact SAP Basis administrator for authorization questions

## 📄 License

This project is distributed under MIT license. See LICENSE file for details.
