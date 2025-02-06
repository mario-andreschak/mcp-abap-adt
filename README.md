```markdown
# mcp-abap-adt: Your Gateway to ABAP Development Tools (ADT)

This project provides a server that allows you to interact with SAP ABAP systems using the Model Context Protocol (MCP).  Think of it as a bridge that lets tools like [Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) (a VS Code extension) talk to your ABAP system and retrieve information like source code, table structures, and more.  It's like having a remote control for your ABAP development environment!

This guide is designed for beginners, so we'll walk through everything step-by-step.  We'll cover:

1.  **Prerequisites:** What you need before you start.
2.  **Installation and Setup:**  Getting everything up and running.
3.  **Running the Server:**  Starting the server in different modes.
4.  **Integrating with Cline:** Connecting this server to the Cline VS Code extension.
5.  **Troubleshooting:**  Common problems and solutions.
6.  **Available Tools:**  A list of the commands you can use.

## 1. Prerequisites

Before you begin, you'll need a few things:

*   **An SAP ABAP System:**  This server connects to an existing ABAP system.  You'll need:
    *   The system's URL (e.g., `https://my-sap-system.com:8000`)
    *   A valid username and password for that system.
    *   The SAP client number (e.g., `100`).
    *   Ensure that your SAP system allows connections via ADT (ABAP Development Tools). This usually involves making sure the necessary services are activated in transaction `SICF`.  Your basis administrator can help with this. Specifically, you will need the following services to be active:
        * `/sap/bc/adt`
    *   For the `GetTableContents` Tool, you will need the implementation of a custom service `/z_mcp_abap_adt/z_tablecontent`. You can follow this guide [here](https://community.sap.com/t5/application-development-blog-posts/how-to-use-rfc-read-table-from-javascript-via-webservice/ba-p/13172358)

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

1.  **Clone the Repository:**
    *   **Using Git (command line):**
        1.  Open a terminal (command prompt or Terminal).
        2.  Navigate to the directory where you want to store the project.  For example, to put it on your Desktop:
            ```bash
            cd Desktop
            ```
        3.  Clone the repository (replace `[repository URL]` with the actual URL of this project's repository on GitHub):
            ```bash
            git clone [repository URL]
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

2.  **Navigate to the `server` directory:**
    ```bash
    cd server
    ```

3.  **Install Dependencies:**  This downloads all the necessary libraries the project needs.  In the terminal, inside the `server` directory, run:
    ```bash
    npm install
    ```
    This might take a few minutes.

4.  **Build the Project:** This compiles the code into an executable format.
    ```bash
    npm run build
    ```

5.  **Create a `.env` file:** This file stores sensitive information like your SAP credentials.  It's *very* important to keep this file secure.
    1.  In the `server` directory, create a new file named `.env` (no extension).
    2.  Open the `.env` file in a text editor (like Notepad, VS Code, etc.).
    3.  Add the following lines, replacing the placeholders with your actual SAP system information:
        ```
        SAP_URL=https://your-sap-system.com:8000  # Your SAP system URL
        SAP_USERNAME=your_username              # Your SAP username
        SAP_PASSWORD=your_password              # Your SAP password
        SAP_CLIENT=100                         # Your SAP client
        ```
        **Important:**  Never share your `.env` file with anyone, and never commit it to a Git repository!

## 3. Running the Server

You can run the server in two main ways:

*   **Standalone Mode:**  This runs the server directly, and it will output messages to the terminal.
*   **Development/Debug Mode:** This runs the server with the Node.js inspector, allowing you to debug the code using tools like VS Code's debugger.

### 3.1 Standalone Mode

To run the server in standalone mode, use the following command in the terminal (from the `server` directory):

```bash
npm run start
```

You should see messages in the terminal indicating that the server is running.  It will listen for connections from MCP clients (like Cline).  The server will keep running until you stop it (usually with Ctrl+C).

### 3.2 Development/Debug Mode (with Inspector)

This mode is useful for debugging.

1.  **Start the server in debug mode:**
    ```bash
    npm run dev
    ```
    This will start the server and output a message like:  `Debugger listening on ws://127.0.0.1:9229/...`.  This is the URL you'll use to connect the debugger.

2.  **Attach a Debugger (e.g., in VS Code):**
    1.  Open the `server` folder in VS Code.
    2.  Go to the "Run and Debug" view (click the bug icon on the left sidebar).
    3.  Click "create a launch.json file".  Choose "Node.js" from the environment options.
    4.  Replace the contents of the `launch.json` file with the following:
        ```json
        {
          "version": "0.2.0",
          "configurations": [
            {
              "type": "node",
              "request": "attach",
              "name": "Attach to Remote",
              "address": "127.0.0.1",  // Use the IP address from the debugger message
              "port": 9229,         // Use the port from the debugger message
              "localRoot": "${workspaceFolder}",
              "remoteRoot": "${workspaceFolder}"
            }
          ]
        }
        ```
        Make sure the `address` and `port` match what's shown in the terminal output from `npm run dev`.
    5.  Press F5 (or click the green "Start Debugging" arrow).  VS Code should connect to the running server, and you can now set breakpoints, step through code, and inspect variables.

## 4. Integrating with Cline

Cline is a VS Code extension that uses MCP servers to provide language support. Here's how to connect this ABAP server to Cline:

1.  **Install Cline:** If you haven't already, install the "Claude Dev" extension in VS Code.

2.  **Open Cline Settings:**
    *   Open the VS Code settings (File -> Preferences -> Settings, or Ctrl+,).
    *   Search for "Cline MCP Settings".
    *   Click "Edit in settings.json". This will open the `cline_mcp_settings.json` file.  The full path is usually something like: `C:\Users\username\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` (replace `username` with your Windows username).

3.  **Add the Server Configuration:**  You'll need to add an entry to the `servers` array in the `cline_mcp_settings.json` file.  Here's an example:

    ```json
    {
      "servers": [
        {
          "id": "abap-adt",
          "name": "ABAP ADT Server",
          "description": "Connects to an ABAP system via ADT.",
          "command": "npm",
          "args": ["run", "start"],
          "cwd": "C:\\path\\to\\your\\mcp-abap-adt\\server", // VERY IMPORTANT: Full path to the 'server' directory. Use double backslashes!
          "timeout": 30000
        },
        // ... other server configurations ...
      ]
    }
    ```

    *   **`id`:**  A unique identifier for this server.
    *   **`name`:**  A user-friendly name for the server (this will appear in Cline).
    *   **`description`:**  A brief description.
    *   **`command`:**  The command to run the server (in this case, `npm`).
    *   **`args`:**  The arguments to pass to the command (`run start` to execute `npm run start`).
    *   **`cwd`:**  **Critical:** The *full, absolute path* to the `server` directory where you cloned the repository.  **Use double backslashes (`\\`) in the path on Windows.**  For example: `C:\\Users\\MyUser\\Desktop\\mcp-abap-adt\\server`. If this is incorrect, Cline won't be able to find and start the server.
    *   **`timeout`:** The timeout (in milliseconds) for server communication.

4.  **Restart VS Code:**  After modifying the `cline_mcp_settings.json` file, restart VS Code for the changes to take effect.

5.  **Test the Connection:**
    *   Open an ABAP file in VS Code (or create a new file with a `.abap` extension).
    *   Cline should automatically connect to the server.  You might see a message in the Cline output panel (View -> Output, then select "Cline" from the dropdown).
    *   Try using one of the tools (see "Available Tools" below) to verify that the connection is working. For example, you could try to get the source code of a program.

## 5. Troubleshooting

*   **`node -v` or `npm -v` gives an error:**
    *   Make sure Node.js is installed correctly.  Try reinstalling it.
    *   Ensure that the Node.js installation directory is in your system's PATH environment variable.  On Windows, you can edit environment variables through the System Properties (search for "environment variables" in the Start Menu).
*   **`npm install` fails:**
    *   Make sure you have an internet connection.
    *   Try deleting the `node_modules` folder and running `npm install` again.
    *   If you're behind a proxy, you might need to configure npm to use the proxy.  Search online for "npm proxy settings".
*   **Cline doesn't connect to the server:**
    *   Double-check the `cwd` setting in `cline_mcp_settings.json`.  It *must* be the correct, absolute path to the `server` directory, and use double backslashes on Windows.
    *   Make sure the server is running (use `npm run start` to check).
    *   Check the Cline output panel in VS Code for error messages.
    *   Restart VS Code.
*   **SAP connection errors:**
    *   Verify your SAP credentials in the `.env` file.
    *   Ensure that the SAP system is running and accessible from your network.
    *   Make sure that your SAP user has the necessary authorizations to access the ADT services.
    *   Check that the required ADT services are activated in transaction `SICF`.

## 6. Available Tools

This server provides the following tools, which can be used through Cline (or any other MCP client):

| Tool Name           | Description                                      | Input Parameters                                             | Example Usage (in Cline)                                   |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `GetProgram`        | Retrieve ABAP program source code.              | `program_name` (string): Name of the ABAP program.            | `@tool GetProgram program_name=ZMY_PROGRAM`                |
| `GetClass`          | Retrieve ABAP class source code.                | `class_name` (string): Name of the ABAP class.              | `@tool GetClass class_name=ZCL_MY_CLASS`                   |
| `GetFunctionGroup`  | Retrieve ABAP Function Group source code.       | `function_group` (string): Name of the function group        |`@tool GetFunctionGroup function_group=ZMY_FUNCTION_GROUP` |
| `GetFunction`       | Retrieve ABAP Function Module source code.       | `function_name` (string), `function_group` (string)      | `@tool GetFunction function_name=ZMY_FUNCTION function_group=ZFG`|
| `GetTable`          | Retrieve ABAP table structure.                  | `table_name` (string): Name of the ABAP table.              | `@tool GetTable table_name=ZMY_TABLE`                      |
| `GetTableContents`  | Retrieve contents of an ABAP table.            | `table_name` (string), `max_rows` (number, optional, default 100) | `@tool GetTableContents table_name=ZMY_TABLE max_rows=50` |
| `GetPackage`        | Retrieve ABAP package details.                  | `package_name` (string): Name of the ABAP package.          | `@tool GetPackage package_name=ZMY_PACKAGE`                |
| `GetTypeInfo`       | Retrieve ABAP type information.                 | `type_name` (string): Name of the ABAP type.                | `@tool GetTypeInfo type_name=ZMY_TYPE`                    |
|`GetInclude`          | Retrieve ABAP include source code           |`include_name` (string): name of the ABAP include`           |`@tool GetInclude include_name=ZMY_INCLUDE`                  |
| `SearchObject`      | Search for ABAP objects using quick search.     | `query` (string), `maxResults` (number, optional, default 100) | `@tool SearchObject query=ZMY* maxResults=20`             |

This README provides a comprehensive guide to installing, setting up, running, and using the `mcp-abap-adt` server. It covers all the requested aspects, including Git/GitHub Desktop, Node.js installation, build and run commands, and Cline integration, with clear, beginner-friendly instructions and troubleshooting tips. The inclusion of a table summarizing the available tools enhances usability. The critical points (like the `cwd` setting in `cline_mcp_settings.json`) are highlighted effectively. The explanations are well-structured and easy to follow.
