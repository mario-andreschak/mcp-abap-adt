# mcp-abap-adt: Your Gateway to ABAP Development Tools (ADT)

This project provides a server that allows you to interact with SAP ABAP systems using the Model Context Protocol (MCP).  Think of it as a bridge that lets tools like [FLUJO](https://github.com/mario-andreschak/FLUJO), [Claude](https://claude.com/download) or [Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) (a VS Code extension) talk to your ABAP system and retrieve information like source code, table structures, and more.  It's like having a remote control for your ABAP development environment!

The server is published on npm as [`mcp-abap-adt`](https://www.npmjs.com/package/mcp-abap-adt) and listed in the [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.mario-andreschak/mcp-abap-adt`, so most MCP clients can install it with a single command (or a single click — see FLUJO below).

This guide is designed for beginners, so we'll walk through everything step-by-step.  We'll cover:

1.  **Prerequisites:** What you need before you start.
2.  **Installation and Setup:**  Getting everything up and running.
3.  **Running the Server:**  Starting the server in different modes.
4.  **Integrating with FLUJO:** The easiest way — one-click install from the Spotlight/Marketplace.
5.  **Integrating with Cline:** Connecting this server to the Cline VS Code extension.
6.  **Integrating with Claude Desktop:** Adding the server to the Claude Desktop app.
7.  **Integrating with Claude Code:** Adding the server via `.mcp.json` or the CLI.
8.  **Troubleshooting:**  Common problems and solutions.
9.  **Available Tools:**  A list of the commands you can use.

## 1. Prerequisites

Before you begin, you'll need a few things:

*   **An SAP ABAP System:**  This server connects to an existing ABAP system.  You'll need:
    *   The system's URL (e.g., `https://my-sap-system.com:8000`)
    *   A valid username and password for that system.
    *   The SAP client number (e.g., `100`).
    *   Ensure that your SAP system allows connections via ADT (ABAP Development Tools). This usually involves making sure the necessary services are activated in transaction `SICF`.  Your basis administrator can help with this. Specifically, you will need the following services to be active:
        * `/sap/bc/adt`

*   **Git (or GitHub Desktop):**  We'll use Git to download the project code.  You have two options:
    *   **Git:**  The command-line tool.  [Download Git](https://git-scm.com/downloads).  Choose the version for your operating system (Windows, macOS, Linux). Follow the installation instructions.
    *   **GitHub Desktop:**  A graphical user interface for Git.  Easier for beginners!  [Download GitHub Desktop](https://desktop.github.com/).  Follow the installation instructions.

*   **Node.js and npm:** Node.js is a JavaScript runtime that lets you run JavaScript code outside of a web browser.  npm (Node Package Manager) is included with Node.js and is used to install packages (libraries of code).
    *   [Download Node.js](https://nodejs.org/en/download/).  **Choose the LTS (Long Term Support) version.**  This is the most stable version. Follow the installation instructions for your operating system.  Make sure to include npm in the installation (it's usually included by default).
    *   **Verify Installation:** After installing Node.js, open a new terminal (command prompt on Windows, Terminal on macOS/Linux) and type:
        ```bash
        node -v
        npm -v
        ```
        You should see version numbers for both Node.js and npm.  If you see an error, Node.js might not be installed correctly, or it might not be in your system's PATH.  (See Troubleshooting below).

## 2. Installation and Setup

Now, let's get the project code and set it up:

### Install from npm (recommended)

The server is published on npm, so you don't need to clone or build anything. Most MCP clients can run it directly with `npx`:

```bash
npx -y mcp-abap-adt
```

You'll typically configure this inside your MCP client rather than run it by hand — point the client at the command `npx` with args `["-y", "mcp-abap-adt"]` and supply your SAP credentials as environment variables (`SAP_URL`, `SAP_USERNAME`, `SAP_PASSWORD`, `SAP_CLIENT`; optionally `SAP_LANGUAGE`, `TLS_REJECT_UNAUTHORIZED`). See the integration sections below for [FLUJO](#4-integrating-with-flujo) and [Cline](#5-integrating-with-cline).

To install it globally instead:

```bash
npm install -g mcp-abap-adt
```

### Manual Installation (from source)
1.  **Clone the Repository:**
    *   **Using Git (command line):**
        1.  Open a terminal (command prompt or Terminal).
        2.  Navigate to the directory where you want to store the project.  For example, to put it on your Desktop:
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
    *   **Using GitHub Desktop:**
        1.  Open GitHub Desktop.
        2.  Click "File" -> "Clone Repository...".
        3.  In the "URL" tab, paste the repository URL.
        4.  Choose a local path (where you want to save the project on your computer).
        5.  Click "Clone".

2.  **Install Dependencies:**  This downloads all the necessary libraries the project needs.  In the terminal, inside the root directory, run:
    ```bash
    npm install
    ```
    This might take a few minutes.

3.  **Build the Project:** This compiles the code into an executable format.
    ```bash
    npm run build
    ```

4.  **Create a `.env` file:** This file stores sensitive information like your SAP credentials.  It's *very* important to keep this file secure.
    1.  In the root directory, create a new file named `.env` (no extension).
    2.  Open the `.env` file in a text editor (like Notepad, VS Code, etc.).
    3.  Add the following lines, replacing the placeholders with your actual SAP system information:
        Important: If your password contains a "#" character, make sure to enclose your password in quotes!
        ```
        SAP_URL=https://your-sap-system.com:8000  # Your SAP system URL
        SAP_USERNAME=your_username              # Your SAP username
        SAP_PASSWORD=your_password              # Your SAP password
        SAP_CLIENT=100                         # Your SAP client
        ```
        **Important:**  Never share your `.env` file with anyone, and never commit it to a Git repository!

## 3. Running the Server

To be fair, you usually dont usually "run" this server on it's own. It is supposed to be integrated into an MCP Client like Cline or Claude Desktop. But you *can* manually run the server in two main ways:

*   **Standalone Mode:**  This runs the server directly, and it will output messages to the terminal. The server will start and wait for client connections, so potentially rendering it useless except to see if it starts.
*   **Development/Debug Mode:** This runs the server with the MCP Inspector. You can open the URL that it outputs in your browser and start playing around.

### 3.1 Standalone Mode

To run the server in standalone mode, use the following command in the terminal (from the root directory):

```bash
npm run start
```

You should see messages in the terminal indicating that the server is running.  It will listen for connections from MCP clients.  The server will keep running until you stop it (usually with Ctrl+C).

### 3.2 Development/Debug Mode (with Inspector)

This mode is useful for debugging.

1.  **Start the server in debug mode:**
    ```bash
    npm run dev
    ```
    This will start the server and output a message like:  `🔍 MCP Inspector is up and running at http://localhost:5173 🚀`.
    This is the URL you'll use to open the MCP inspector in your Browser.

## 4. Integrating with FLUJO

[FLUJO](https://github.com/mario-andreschak/FLUJO) is the easiest way to use this server — no cloning, building, or editing JSON config. `mcp-abap-adt` is a curated Spotlight server, so it installs with a single click:

1.  In FLUJO, navigate to **MCP**.
2.  Click **Add Server**.
3.  On the **Spotlight** tab, click **mcp-abap-adt** (or switch to the **Marketplace** tab and find it there).
4.  FLUJO fetches the package automatically and opens the **Local Server** tab. Enter your SAP **URL**, **Username**, and **Password** (and client), then click **Save**.

That's it — FLUJO downloads and runs the npm package for you.

### Streamable HTTP transport (via FLUJO)

`mcp-abap-adt` runs over stdio. If you need to reach it over **streamable HTTP** — for example from another app on your machine or a client that only speaks HTTP — let FLUJO re-host it: install the server in FLUJO as above, then toggle **"Expose to external apps"** on the server. FLUJO's built-in mcp-proxy then serves it over HTTP at `http://localhost:4200/mcp-proxy/mcp-abap-adt`, and any HTTP-capable MCP client can connect with a config like:

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "type": "http",
      "url": "http://localhost:4200/mcp-proxy/mcp-abap-adt"
    }
  }
}
```

FLUJO keeps your SAP credentials with the installed server, so the HTTP config itself carries none.

## 5. Integrating with Cline

Cline is a VS Code extension that uses MCP servers to provide language support. Here's how to connect this ABAP server to Cline:

1.  **Install Cline:** If you haven't already, install the "Cline" extension in VS Code.

2.  **Open Cline Settings:**
    *   Open the VS Code settings (File -> Preferences -> Settings, or Ctrl+,).
    *   Search for "Cline MCP Settings".
    *   Click "Edit in settings.json". This will open the `cline_mcp_settings.json` file.  The full path is usually something like: `C:\Users\username\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` (replace `username` with your Windows username).

3.  **Add the Server Configuration:**  You'll need to add an entry to the `mcpServers` object in the `cline_mcp_settings.json` file.  The recommended way is to run the published npm package via `npx` and pass your SAP credentials as environment variables — no local build required:

    ```json
    {
      "mcpServers": {
        "mcp-abap-adt": {
          "command": "npx",
          "args": ["-y", "mcp-abap-adt"],
          "env": {
            "SAP_URL": "https://your-sap-system.com:8000",
            "SAP_USERNAME": "your_username",
            "SAP_PASSWORD": "your_password",
            "SAP_CLIENT": "100"
          },
          "disabled": false,
          "autoApprove": []
        }
        // ... other server configurations ...
      }
    }
    ```

    If you installed from source instead (see Manual Installation), point `command` at `node` with an absolute path to the build output, e.g. `"args": ["C:/PATH_TO/mcp-abap-adt/dist/index.js"]`, and configure credentials via the `.env` file.

4.  **Test the Connection:**
    *   Cline should automatically connect to the server.  You will see the Server appear in the "MCP Servers" Panel (in the Cline extension, you'll find different buttons on the top.)
    *   Ask Cline to get the Sourcecode of a program and it should mention the MCP Server and should try to use the corresponding tools

## 6. Integrating with Claude Desktop

[Claude Desktop](https://claude.ai/download) can run this server directly via the published npm package.

1.  Open Claude Desktop → **Settings** → **Developer** → **Edit Config**. This opens `claude_desktop_config.json`. The file lives at:
    *   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
    *   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

2.  Add an `mcp-abap-adt` entry under `mcpServers`, filling in your SAP credentials:

    ```json
    {
      "mcpServers": {
        "mcp-abap-adt": {
          "command": "npx",
          "args": ["-y", "mcp-abap-adt"],
          "env": {
            "SAP_URL": "https://your-sap-system.com:8000",
            "SAP_USERNAME": "your_username",
            "SAP_PASSWORD": "your_password",
            "SAP_CLIENT": "100"
          }
        }
      }
    }
    ```

3.  Save the file and **restart Claude Desktop**. The ABAP tools appear under the tools (🔨) menu.

> **Windows tip:** if `npx` isn't found, set `"command": "npx.cmd"`, or use the full path to `node` with the absolute path to `dist/index.js` from a source install.

## 7. Integrating with Claude Code

[Claude Code](https://claude.com/claude-code) reads MCP servers from a `.mcp.json` file in your project root (shared with your team) or from user/project scope via the CLI.

**Option A — `.mcp.json` in your project root:**

```json
{
  "mcpServers": {
    "mcp-abap-adt": {
      "command": "npx",
      "args": ["-y", "mcp-abap-adt"],
      "env": {
        "SAP_URL": "https://your-sap-system.com:8000",
        "SAP_USERNAME": "your_username",
        "SAP_PASSWORD": "your_password",
        "SAP_CLIENT": "100"
      }
    }
  }
}
```

Because this file is committed to your repo, avoid putting real passwords in it — either use placeholder values that each developer fills in locally, or reference environment variables (Claude Code expands `${VAR}` in `.mcp.json`), e.g. `"SAP_PASSWORD": "${SAP_PASSWORD}"`.

**Option B — add it from the CLI:**

```bash
claude mcp add mcp-abap-adt \
  --env SAP_URL=https://your-sap-system.com:8000 \
  --env SAP_USERNAME=your_username \
  --env SAP_PASSWORD=your_password \
  --env SAP_CLIENT=100 \
  -- npx -y mcp-abap-adt
```

Add `--scope project` to write it to the shared `.mcp.json`, or `--scope user` to make it available across all your projects. Verify with `claude mcp list`.

## 8. Troubleshooting

*   **`node -v` or `npm -v` gives an error:**
    *   Make sure Node.js is installed correctly.  Try reinstalling it.
    *   Ensure that the Node.js installation directory is in your system's PATH environment variable.  On Windows, you can edit environment variables through the System Properties (search for "environment variables" in the Start Menu).
*   **`npm install` fails:**
    *   Make sure you have an internet connection.
    *   Try deleting the `node_modules` folder and running `npm install` again.
    *   If you're behind a proxy, you might need to configure npm to use the proxy.  Search online for "npm proxy settings".
*   **Cline doesn't connect to the server:**
    *   Double-check the settings in `cline_mcp_settings.json`.  It *must* be the correct, absolute path to the `root-server` directory, and use double backslashes on Windows.
    *   Make sure the server is running (use `npm run start` to check).
    *   Restart VS Code.
    *   Alternatively: 
    *   Navigate to the root folder of mcp-abap-adt in your Explorer, Shift+Right-Click and select "Open Powershell here". (Or open a Powershell and navigate to the folder using `cd C:/PATH_TO/mcp-abap-adt/`
    *   Run "npm install"
    *   Run "npm run build"
    *   Run "npx @modelcontextprotocol/inspector node dist/index.js"
    *   Open your browser at the URL it outputs. Click "connect" on the left side.
    *   Click "Tools" on the top, then click "List Tools"
    *   Click GetProgram and enter "SAPMV45A" or any other Report name as Program Name on the right
    *   Test and see what the output is
*   **SAP connection errors:**
    *   Verify your SAP credentials in the `.env` file.
    *   Ensure that the SAP system is running and accessible from your network.
    *   Make sure that your SAP user has the necessary authorizations to access the ADT services.
    *   Check that the required ADT services are activated in transaction `SICF`.
    *   If you're using self-signed certificates or there is an issue with your SAP systems http config, make sure to set TLS_REJECT_UNAUTHORIZED as described above!

## 9. Available Tools

This server provides the following tools, which can be used through FLUJO, Cline, Claude Desktop, Claude Code, or any other MCP client:

| Tool Name           | Description                                       | Input Parameters                                                   | Example Usage (in Cline)                                   |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `GetProgram`        | Retrieve ABAP program source code.                | `program_name` (string): Name of the ABAP program.                 | `@tool GetProgram program_name=ZMY_PROGRAM`                |
| `GetClass`          | Retrieve ABAP class source code.                  | `class_name` (string): Name of the ABAP class.                     | `@tool GetClass class_name=ZCL_MY_CLASS`                   |
| `GetFunctionGroup`  | Retrieve ABAP Function Group source code.         | `function_group` (string): Name of the function group              | `@tool GetFunctionGroup function_group=ZMY_FUNCTION_GROUP` |
| `GetFunction`       | Retrieve ABAP Function Module source code.        | `function_name` (string), `function_group` (string)                | `@tool GetFunction function_name=ZMY_FUNCTION function_group=ZFG`|
| `GetStructure`      | Retrieve ABAP Structure.                          | `structure_name` (string): Name of the DDIC Structure.             | `@tool GetStructure structure_name=ZMY_STRUCT`             |
| `GetTable`          | Retrieve ABAP table structure.                    | `table_name` (string): Name of the ABAP DB table.                  | `@tool GetTable table_name=ZMY_TABLE`                      |
| `GetTableContents`  | Retrieve contents of an ABAP table.               | `table_name` (string), `max_rows` (number, optional, default 100)  | `@tool GetTableContents table_name=ZMY_TABLE max_rows=50`  |
| `GetCDSView`        | Retrieve CDS view (DDL source) source code.       | `cds_view_name` (string): Name of the CDS view (DDL source name).  | `@tool GetCDSView cds_view_name=I_CURRENCY`                |
| `GetPackage`        | Retrieve ABAP package details.                    | `package_name` (string): Name of the ABAP package.                 | `@tool GetPackage package_name=ZMY_PACKAGE`                |
| `GetTypeInfo`       | Retrieve ABAP type information.                   | `type_name` (string): Name of the ABAP type.                       | `@tool GetTypeInfo type_name=ZMY_TYPE`                     |
| `GetInclude`        | Retrieve ABAP include source code                 | `include_name` (string): name of the ABAP include`                 | `@tool GetInclude include_name=ZMY_INCLUDE`                |
| `SearchObject`      | Search for ABAP objects using quick search.       | `query` (string), `maxResults` (number, optional, default 100)     | `@tool SearchObject query=ZMY* maxResults=20`              |
| `GetInterface`      | Retrieve ABAP interface source code.              | `interface_name` (string): Name of the ABAP interface.             | `@tool GetInterface interface_name=ZIF_MY_INTERFACE`       |
| `GetTransaction`    | Retrieve ABAP transaction details.                | `transaction_name` (string): Name of the ABAP transaction.         | `@tool GetTransaction transaction_name=ZMY_TRANSACTION`    |
| `GetBehaviorDefinition` | Retrieve RAP Behavior Definition (BDEF) source. Requires ~NW 7.54 / S/4HANA. | `behavior_definition_name` (string): Name of the RAP Behavior Definition. | `@tool GetBehaviorDefinition behavior_definition_name=ZMY_ENTITY` |
| `GetServiceDefinition`  | Retrieve RAP Service Definition (SRVD) source. Requires ~NW 7.54 / S/4HANA.  | `service_definition_name` (string): Name of the RAP Service Definition.   | `@tool GetServiceDefinition service_definition_name=ZMY_SERVICE`  |



<a href="https://glama.ai/mcp/servers/gwkh12xlu7">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/gwkh12xlu7/badge" alt="ABAP ADT MCP server" />
</a>
