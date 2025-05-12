# SAP ABAP Authentication CLI

This CLI utility allows you to automatically obtain an OAuth2 JWT token (XSUAA) or use basic authentication to connect to SAP BTP ABAP Environment using a service key.

## Requirements

- Node.js (>= 14.x)
- Service key file in JSON format from SAP BTP ABAP Environment

## Creating a Service Key

1. Log in to SAP BTP Cockpit
2. Go to your ABAP Environment (or Trial)
3. Select "Service Keys" (or create a service instance if you don't have one yet)
4. Create a new Service Key with the required parameters
5. Copy the JSON data and save it to a file (e.g., `abap-service-key.json`)

## Usage

```bash
# Using npm script
yarn auth -- -k path/to/service-key.json
# or
npm run auth -- -k path/to/service-key.json

# Or directly via Node.js
node tools/sap-abap-auth-browser.js auth -k path/to/service-key.json
```

## Result

The CLI utility will:

1. Read the service key file
2. Obtain an OAuth2 JWT token via XSUAA (or use basic)
3. Extract the URL and client of the SAP ABAP system
4. Update the `.env` file with the required values for JWT (xsuaa) or basic authentication
5. Display the operation status in the console

## Example service key file structure

```json
{
  "uaa": {
    "clientid": "...",
    "clientsecret": "...",
    "url": "https://...",
    "tokenendpoint": "https://..."
  },
  "abap": {
    "url": "https://...",
    "sapClient": "100"
  },
  "endpoints": {
    "api": "https://..."
  }
}
```

## Example .env for JWT (xsuaa) and basic

```
SAP_URL=https://your-abap-url
SAP_CLIENT=100
SAP_AUTH_TYPE=xsuaa
SAP_JWT_TOKEN=your_jwt_token_here
# or for basic
# SAP_AUTH_TYPE=basic
# SAP_USERNAME=your_username
# SAP_PASSWORD=your_password
```

## For developers

- To change authentication logic, modify the relevant functions in `sap-abap-auth-browser.js`.
- The MCP server automatically uses JWT or basic according to the .env.
