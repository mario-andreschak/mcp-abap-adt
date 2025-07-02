# mcp-abap-adt: Your Gateway to ABAP Development Tools (ADT)

[![smithery badge](https://smithery.ai/badge/@mario-andreschak/mcp-abap-adt)](https://smithery.ai/server/@mario-andreschak/mcp-abap-adt)

This project provides a server that allows you to interact with SAP ABAP systems using the Model Context Protocol (MCP). Think of it as a bridge that lets tools like [Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) (a VS Code extension) talk to your ABAP system and retrieve information like source code, table structures, and more. It's like having a remote control for your ABAP development environment!

<a href="https://glama.ai/mcp/servers/gwkh12xlu7">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/gwkh12xlu7/badge" alt="ABAP ADT MCP server" />
</a>

## 🆕 What's New in BTP Branch

This branch includes several powerful new features:

- **🔍 Enhancement Analysis Tools**: `GetEnhancements`, `GetEnhancementByName` - Comprehensive enhancement discovery and analysis
- **📋 Include Management**: `GetIncludesList` - Recursive include discovery and hierarchy mapping  
- **🚀 SAP BTP Support**: JWT/XSUAA authentication with browser-based token helper
- **💾 Freestyle SQL**: `GetSqlQuery` - Execute custom SQL queries via ADT Data Preview API
- **⚙️ Advanced Configuration**: Configurable timeouts, flexible .env loading, enhanced logging
- **🛠️ Developer Tools**: New testing utilities and improved error handling

This guide is designed for beginners, so we'll walk through everything step-by-step. We'll cover:

1.  **Prerequisites:** What you need before you start.
2.  **Installation and Setup:** Getting everything up and running.
3.  **Running the Server:** Starting the server in different modes.
4.  **Integrating with Cline:** Connecting this server to the Cline VS Code extension.
5.  **Troubleshooting:** Common problems and solutions.
6.  **Available Tools:** A list of the commands you can use.

## 1. Prerequisites

Before you begin, you'll need a few things:

- **An SAP ABAP System:** This server connects to an existing ABAP system. You'll need:

  - The system's URL (e.g., `https://my-sap-system.com:8000`)
  - A valid username and password for that system.
  - The SAP client number (e.g., `100`).
  - Ensure that your SAP system allows connections via ADT (ABAP Development Tools). This usually involves making sure the necessary services are activated in transaction `SICF`. Your basis administrator can help with this. Specifically, you will need the following services to be active:
    - `/sap/bc/adt`
  - For the `GetTableContents` Tool, you will need the implementation of a custom service `/z_mcp_abap_adt/z_tablecontent`. You can follow this guide [here](https://community.sap.com/t5/application-development-blog-posts/how-to-use-rfc-read-table-from-javascript-via-webservice/ba-p/13172358)

- **Git (or GitHub Desktop):** We'll use Git to download the project code. You have two options:

  - **Git:** The command-line tool. [Download Git](https://git-scm.com/downloads). Choose the version for your operating system (Windows, macOS, Linux). Follow the installation instructions.
  - **GitHub Desktop:** A graphical user interface for Git. Easier for beginners! [Download GitHub Desktop](https://desktop.github.com/). Follow the installation instructions.

- **Node.js and npm:** Node.js is a JavaScript runtime that lets you run JavaScript code outside of a web browser. npm (Node Package Manager) is included with Node.js and is used to install packages (libraries of code).
  - [Download Node.js](https://nodejs.org/en/download/). **Choose the LTS (Long Term Support) version.** This is the most stable version. Follow the installation instructions for your operating system. Make sure to include npm in the installation (it's usually included by default).
  - **Verify Installation:** After installing Node.js, open a new terminal (command prompt on Windows, Terminal on macOS/Linux) and type:
    ```bash
    node -v
    npm -v
    ```
    You should see version numbers for both Node.js and npm. If you see an error, Node.js might not be installed correctly, or it might not be in your system's PATH. (See Troubleshooting below).

## 2. Installation and Setup

Now, let's get the project code and set it up:

### Installing via Smithery

To install MCP ABAP Development Tools Server for Cline automatically via [Smithery](https://smithery.ai/server/@mario-andreschak/mcp-abap-adt):

```bash
npx -y @smithery/cli install @mario-andreschak/mcp-abap-adt --client cline
```

### Manual Installation

1.  **Clone the Repository:**

    - **Using Git (command line):**
      1.  Open a terminal (command prompt or Terminal).
      2.  Navigate to the directory where you want to store the project. For example, to put it on your Desktop:
          ```bash
          cd Desktop
          ```
      3.  Clone the repository:
          ```bash
          git clone https://github.com/mario-andreschak/mcp-abap-adt
          ```
      4.  Change into the project directory:
          ```bash
          cd mcp-abap-adt  # Or whatever the folder name is
          ```
    - **Using GitHub Desktop:**
      1.  Open GitHub Desktop.
      2.  Click "File" -> "Clone Repository...".
      3.  In the "URL" tab, paste the repository URL.
      4.  Choose a local path (where you want to save the project on your computer).
      5.  Click "Clone".

2.  **Install Dependencies:** This downloads all the necessary libraries the project needs. In the terminal, inside the root directory, run:

    ```bash
    npm install
    ```

    This might take a few minutes.

3.  **Build the Project:** This compiles the code into an executable format.

    ```bash
    npm run build
    ```

4.  **Create a `.env` file:** This file stores sensitive information like your SAP credentials. It's _very_ important to keep this file secure.

    1.  In the root directory, create a new file named `.env` (no extension).
    2.  Open the `.env` file in a text editor (like Notepad, VS Code, etc.).
    3.  Add one of the following options (JWT/XSUAA or basic):

        For JWT (XSUAA) authorization:

        ```
        SAP_URL=https://your-sap-system.com:8000  # Your SAP system URL
        SAP_CLIENT=100                            # Your SAP client
        SAP_AUTH_TYPE=xsuaa
        SAP_JWT_TOKEN=your_jwt_token_here         # JWT токен, отриманий через sap-abap-auth-browser.js
        
        # Optional timeout configuration (in milliseconds)
        SAP_TIMEOUT_DEFAULT=45000                 # Default timeout (45 seconds)
        SAP_TIMEOUT_CSRF=15000                    # CSRF token timeout (15 seconds)
        SAP_TIMEOUT_LONG=60000                    # Long operations timeout (60 seconds)
        ```

        For basic authorization:

        ```
        SAP_URL=https://your-sap-system.com:8000  # Your SAP system URL
        SAP_CLIENT=100                            # Your SAP client
        SAP_AUTH_TYPE=basic
        SAP_USERNAME=your_username                # Your SAP username
        SAP_PASSWORD=your_password                # Your SAP password
        
        # Optional timeout configuration (in milliseconds)
        SAP_TIMEOUT_DEFAULT=45000                 # Default timeout (45 seconds)
        SAP_TIMEOUT_CSRF=15000                    # CSRF token timeout (15 seconds)
        SAP_TIMEOUT_LONG=60000                    # Long operations timeout (60 seconds)
        ```

        **Important:** Never share your `.env` file with anyone, and never commit it to a Git repository!

        > ⚠️ Only two authorization types are supported: basic (username+password) and JWT (XSUAA, SAP_JWT_TOKEN). SSO/cookie flow is not supported.

### 🚀 SAP BTP Authentication Helper (NEW!)

For **SAP BTP ABAP Environment (Steampunk)** users, we provide a convenient browser-based authentication tool that automatically obtains JWT tokens and configures your `.env` file:

```bash
node tools/sap-abap-auth-browser.js auth --key path/to/your/service-key.json --browser chrome
```

**Parameters:**
- `--key <path>`: Path to your SAP BTP service key JSON file (required)
- `--browser <browser>`: Browser to open (chrome, edge, firefox, system, none). Use 'none' to get URL for manual copy

**What it does:**
1. Reads your SAP BTP service key
2. Opens your browser for OAuth2 authentication
3. Automatically exchanges the authorization code for a JWT token
4. Creates/updates your `.env` file with the correct configuration

**Example:**
```bash
# Using Chrome browser
node tools/sap-abap-auth-browser.js auth --key ./my-service-key.json --browser chrome

# Manual URL copy (no browser opening)
node tools/sap-abap-auth-browser.js auth --key ./my-service-key.json --browser none
```

This tool is especially useful for SAP BTP environments where you need JWT authentication instead of basic username/password.

### ⚙️ Advanced Configuration Options (NEW!)

**Timeout Configuration:**
The server now supports configurable timeouts for different types of operations. You can customize these in your `.env` file:

- `SAP_TIMEOUT_DEFAULT=45000` - Default timeout for most operations (45 seconds)
- `SAP_TIMEOUT_CSRF=15000` - Timeout for CSRF token requests (15 seconds)  
- `SAP_TIMEOUT_LONG=60000` - Timeout for long-running operations like SQL queries and table contents (60 seconds)

**Enhanced .env File Loading:**
The server now supports flexible .env file loading:
- Automatic detection of .env files in current directory or project root
- Custom .env file path via `--env` parameter: `node dist/index.js --env=/path/to/custom.env`
- Better error handling and logging for configuration issues

**Improved Logging:**
Enhanced logging system provides better debugging information and operation tracking.

## 3. Running the Server

To be fair, you usually dont usually "run" this server on it's own. It is supposed to be integrated into an MCP Client like Cline or Claude Desktop. But you _can_ manually run the server in two main ways:

- **Standalone Mode:** This runs the server directly, and it will output messages to the terminal. The server will start and wait for client connections, so potentially rendering it useless except to see if it starts.
- **Development/Debug Mode:** This runs the server with the MCP Inspector. You can open the URL that it outputs in your browser and start playing around.

### 3.1 Standalone Mode

To run the server in standalone mode, use the following command in the terminal (from the root directory):

```bash
npm run start
```

You should see messages in the terminal indicating that the server is running. It will listen for connections from MCP clients. The server will keep running until you stop it (usually with Ctrl+C).

### 3.2 Development/Debug Mode (with Inspector)

This mode is useful for debugging.

1.  **Start the server in debug mode:**
    ```bash
    npm run dev
    ```
    This will start the server and output a message like: `🔍 MCP Inspector is up and running at http://localhost:5173 🚀`.
    This is the URL you'll use to open the MCP inspector in your Browser.

## 4. Integrating with Cline

Cline is a VS Code extension that uses MCP servers to provide language support. Here's how to connect this ABAP server to Cline:

1.  **Install Cline:** If you haven't already, install the "Cline" extension in VS Code.

2.  **Open Cline Settings:**

    - Open the VS Code settings (File -> Preferences -> Settings, or Ctrl+,).
    - Search for "Cline MCP Settings".
    - Click "Edit in settings.json". This will open the `cline_mcp_settings.json` file. The full path is usually something like: `C:\Users\username\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` (replace `username` with your Windows username).

3.  **Add the Server Configuration:** You'll need to add an entry to the `servers` array in the `cline_mcp_settings.json` file. Here's an example:

    ```json
    {
      "mcpServers": {
        "mcp-abap-adt": {
          "command": "node",
          "args": ["C:/PATH_TO/mcp-abap-adt/dist/index.js"],
          "disabled": true,
          "autoApprove": []
        }
        // ... other server configurations ...
      }
    }
    ```

4.  **Test the Connection:**
    - Cline should automatically connect to the server. You will see the Server appear in the "MCP Servers" Panel (in the Cline extension, you'll find different buttons on the top.)
    - Ask Cline to get the Sourcecode of a program and it should mention the MCP Server and should try to use the corresponding tools

## 5. Testing

The project includes comprehensive test suites located in the `tests/` directory. These tests help verify functionality and performance of various MCP tools.

### Running Tests

```bash
# Quick performance tests (recommended for development)
node tests/test-rm07docs-fast.js

# Comprehensive enhancement tests
node tests/test-rm07docs-enhancements.js

# Include list functionality
node tests/test-get-includes-list.js

# Large program handling
node tests/test-sapmv45a-large-program-fixed.js
```

### Test Categories

- **Enhancement Tests**: Verify enhancement discovery and analysis functionality
- **Include Tests**: Test include list retrieval and hierarchy mapping
- **Program Tests**: Test program retrieval and large program handling
- **Infrastructure Tests**: Test CSRF, timeouts, and communication protocols

For detailed information about available tests and their usage, see [tests/README.md](tests/README.md).

## 6. Troubleshooting

- **`node -v` or `npm -v` gives an error:**
  - Make sure Node.js is installed correctly. Try reinstalling it.
  - Ensure that the Node.js installation directory is in your system's PATH environment variable. On Windows, you can edit environment variables through the System Properties (search for "environment variables" in the Start Menu).
- **`npm install` fails:**
  - Make sure you have an internet connection.
  - Try deleting the `node_modules` folder and running `npm install` again.
  - If you're behind a proxy, you might need to configure npm to use the proxy. Search online for "npm proxy settings".
- **Cline doesn't connect to the server:**
  - Double-check the settings in `cline_mcp_settings.json`. It _must_ be the correct, absolute path to the `root-server` directory, and use double backslashes on Windows.
  - Make sure the server is running (use `npm run start` to check).
  - Restart VS Code.
  - Alternatively:
  - Navigate to the root folder of mcp-abap-adt in your Explorer, Shift+Right-Click and select "Open Powershell here". (Or open a Powershell and navigate to the folder using `cd C:/PATH_TO/mcp-abap-adt/`
  - Run "npm install"
  - Run "npm run build"
  - Run "npx @modelcontextprotocol/inspector node dist/index.js"
  - Open your browser at the URL it outputs. Click "connect" on the left side.
  - Click "Tools" on the top, then click "List Tools"
  - Click GetProgram and enter "SAPMV45A" or any other Report name as Program Name on the right
  - Test and see what the output is
- **SAP connection errors:**
  - Verify your SAP credentials in the `.env` file.
  - Ensure that the SAP system is running and accessible from your network.
  - Make sure that your SAP user has the necessary authorizations to access the ADT services.
  - Check that the required ADT services are activated in transaction `SICF`.
  - If you're using self-signed certificates or there is an issue with your SAP systems http config, make sure to set TLS_REJECT_UNAUTHORIZED as described above!
- **Performance Issues:**
  - Use the test suite to identify bottlenecks: `node tests/test-rm07docs-fast.js`
  - Adjust timeout values in your `.env` file for slower systems
  - Consider using `include_nested=false` for faster enhancement searches
  - For large programs, increase timeout values or process includes individually

## 7. Available Tools

This server provides the following tools, which can be used through Cline (or any other MCP client):

| Tool Name          | Description                                 | Input Parameters                                                  | Example Usage (in Cline)                                          |
| ------------------ | ------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GetProgram`       | Retrieve ABAP program source code.          | `program_name` (string): Name of the ABAP program.                | `@tool GetProgram program_name=ZMY_PROGRAM`                       |
| `GetClass`         | Retrieve ABAP class source code.            | `class_name` (string): Name of the ABAP class.                    | `@tool GetClass class_name=ZCL_MY_CLASS`                          |
| `GetFunctionGroup` | Retrieve ABAP Function Group source code.   | `function_group` (string): Name of the function group             | `@tool GetFunctionGroup function_group=ZMY_FUNCTION_GROUP`        |
| `GetFunction`      | Retrieve ABAP Function Module source code.  | `function_name` (string), `function_group` (string)               | `@tool GetFunction function_name=ZMY_FUNCTION function_group=ZFG` |
| `GetStructure`     | Retrieve ABAP Structure.                    | `structure_name` (string): Name of the DDIC Structure.            | `@tool GetStructure structure_name=ZMY_STRUCT`                    |
| `GetTable`         | Retrieve ABAP table structure.              | `table_name` (string): Name of the ABAP DB table.                 | `@tool GetTable table_name=ZMY_TABLE`                             |
| `GetTableContents` | Retrieve contents of an ABAP table.         | `table_name` (string), `max_rows` (number, optional, default 100) | `@tool GetTableContents table_name=ZMY_TABLE max_rows=50`         |
| `GetPackage`       | Retrieve ABAP package details.              | `package_name` (string): Name of the ABAP package.                | `@tool GetPackage package_name=ZMY_PACKAGE`                       |
| `GetTypeInfo`      | Retrieve ABAP type information.             | `type_name` (string): Name of the ABAP type.                      | `@tool GetTypeInfo type_name=ZMY_TYPE`                            |
| `GetInclude`       | Retrieve ABAP include source code           | `include_name` (string): name of the ABAP include`                | `@tool GetInclude include_name=ZMY_INCLUDE`                       |
| `SearchObject`     | Search for ABAP objects using quick search. | `query` (string), `maxResults` (number, optional, default 100)    | `@tool SearchObject query=ZMY* maxResults=20`                     |
| `GetInterface`     | Retrieve ABAP interface source code.        | `interface_name` (string): Name of the ABAP interface.            | `@tool GetInterface interface_name=ZIF_MY_INTERFACE`              |
| `GetTransaction`   | Retrieve ABAP transaction details.          | `transaction_name` (string): Name of the ABAP transaction.        | `@tool GetTransaction transaction_name=ZMY_TRANSACTION`           |
| `GetEnhancements`  | 🔍 **ENHANCEMENT ANALYSIS**: Retrieve and analyze enhancement implementations in ABAP programs or includes. Automatically detects object type and extracts enhancement source code. Use `include_nested=true` for **COMPREHENSIVE RECURSIVE SEARCH** across all nested includes - finds ALL enhancements in the entire program hierarchy. | `object_name` (string): Name of the program or include, `program` (string, optional): For includes, manually specify parent program if auto-detection fails, `include_nested` (boolean, optional): If true, performs recursive enhancement search in all nested includes | `@tool GetEnhancements object_name=SD_SALES_DOCUMENT_VIEW` or `@tool GetEnhancements object_name=mv45afzz program=SAPMV45A include_nested=true` |
| `GetEnhancementImpl` | 📝 **ENHANCEMENT BY NAME**: Retrieve source code of a specific enhancement implementation by its name and enhancement spot. | `enhancement_spot` (string): Name of the enhancement spot, `enhancement_name` (string): Name of the specific enhancement implementation | `@tool GetEnhancementImpl enhancement_spot=enhoxhh enhancement_name=zpartner_update_pai` |
| `GetEnhancementSpot` | Retrieve metadata and list of implementations for a specific enhancement spot. | `enhancement_spot` (string): Name of the enhancement spot | `@tool GetEnhancementSpot enhancement_spot=enhoxhh` |
| `GetBdef` | Retrieve the source code of a BDEF (Behavior Definition) for a CDS entity. | `bdef_name` (string): Name of the BDEF (Behavior Definition) | `@tool GetBdef bdef_name=Z_I_MYENTITY` |
| `GetIncludesInProgram` | List all includes in a given ABAP program. | `program_name` (string): Name of the ABAP program | `@tool GetIncludesInProgram program_name=SAPMV45A` |
| `GetObjectsByType` | List ABAP objects by type. | `object_type` (string): Type of object (e.g., class, program, include, etc.) | `@tool GetObjectsByType object_type=class` |
| `GetRelatedObjectTypes` | Retrieve related ABAP object types for a given object. | `object_name` (string): Name of the ABAP object | `@tool GetRelatedObjectTypes object_name=SAPMV45A` |
| `GetSqlQuery` | **FREESTYLE SQL QUERIES**: Execute SQL queries via SAP ADT Data Preview API. Supports SELECT, WITH statements and other read-only SQL operations. | `sql_query` (string): SQL query to execute, `row_number` (number, optional, default 100): Maximum number of rows to return | `@tool GetSqlQuery sql_query="SELECT * FROM mara WHERE matnr LIKE 'TEST%'" row_number=50` |
| `GetIncludesList` | 📋 **INCLUDE INVENTORY**: Recursively discover and list ALL include files within an ABAP program or include. Performs code analysis to find include statements and builds a complete hierarchy. Use this when you need to understand the program structure. | `object_name` (string): Name of the ABAP program or include, `object_type` (string): Type of object (program or include) | `@tool GetIncludesList object_name=SAPMV45A object_type=program` |
| `GetWhereUsed` | 🔍 **WHERE USED ANALYSIS**: Retrieve where-used references for ABAP objects via ADT usageReferences. Shows all places where a specific object (class, program, include, etc.) is used in the system. By default returns minimal relevant results, use detailed=true for complete analysis. | `object_name` (string): Name of the ABAP object to search usages for, `object_type` (string): Type of object (class, program, include, function, interface, package), `detailed` (boolean, optional): If true, returns all references including packages and internal components. Default is false (minimal results). | `@tool GetWhereUsed object_name=RM07ALVI object_type=include` or `@tool GetWhereUsed object_name=CL_BUS_ABSTRACT_MAIN_SCREEN object_type=class detailed=true` |
