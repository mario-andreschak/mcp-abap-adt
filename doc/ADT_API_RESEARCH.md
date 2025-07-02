# ADT API Research: Object Creation

## 1. Overview

The ABAP Development Tools (ADT) REST API allows programmatic access to ABAP repository objects. Object creation is performed via HTTP POST requests to specific endpoints, with payloads in XML or JSON.

- [SAP Help Portal: ABAP Development Tools Overview](https://help.sap.com/docs/abap-development-tools)
- [SAP Community: Introduction to ADT](https://community.sap.com/topics/abap-development-tools)

## 2. Endpoints for Object Creation

### Class Creation

- **Endpoint:** `/sap/bc/adt/oo/classes`
- **Method:** POST
- **Payload Example:** XML with class metadata (name, description, visibility, interfaces, etc.)
- [SAP API Business Hub: ADT Class API](https://api.sap.com/api/ADT_CLASS/overview)

### Table Creation

- **Endpoint:** `/sap/bc/adt/ddic/tables`
- **Method:** POST
- **Payload Example:** XML with table definition (name, fields, types, keys, etc.)
- [SAP API Business Hub: ADT Table API](https://api.sap.com/api/ADT_TABLE/overview)

### Function Module Creation

- **Endpoint:** `/sap/bc/adt/functions/groups`
- **Method:** POST
- **Payload Example:** XML with function group/module metadata
- [SAP API Business Hub: ADT Function Group API](https://api.sap.com/api/ADT_FUNCTION_GROUP/overview)

## 3. Required Parameters

- Object name (unique, following SAP naming conventions)
- Description
- Object-specific attributes (e.g., fields for tables, methods for classes)
- Package assignment
- Transport request (optional/required depending on system settings)

- [SAP Naming Conventions](https://help.sap.com/docs/abap-cloud/abap-rap/naming-conventions)
- [ADT Object Metadata Reference](https://help.sap.com/docs/abap-development-tools/metadata)

## 4. Authorization & Permissions

- User must have developer rights in the target ABAP system
- S_DEVELOP and S_TRANSPORT authorizations required
- API access may be restricted by SAP system configuration

- [SAP Authorization Objects](https://help.sap.com/docs/sap_netweaver_platform/authorization-objects)
- [ADT Security Guide](https://help.sap.com/docs/abap-development-tools/security)

## 5. API Limitations

- Not all object types may be supported for creation via ADT API
- Some attributes may require additional API calls (e.g., adding methods after class creation)
- Error handling: API returns HTTP error codes and XML error messages

- [SAP Community: ADT API Limitations](https://community.sap.com/t5/application-development-discussions/adt-rest-api-limitations/td-p/13580856)
- [SAP Help Portal: Error Handling in ADT](https://help.sap.com/docs/abap-development-tools/error-handling)

## 6. References

- [SAP Help Portal: ABAP Development Tools](https://help.sap.com/docs/abap-development-tools)
- [SAP Community: ADT REST API Examples](https://community.sap.com/topics/abap-development-tools)

---

_Last updated: 2025-07-01_
