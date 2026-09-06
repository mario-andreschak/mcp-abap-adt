# Classic screen creation and update (#17)

The current MCP server exposes sixteen read-only ADT tools. It does not create or update classic dynpro layouts, flow logic, or screen attributes.

[SAP's dynpro reference](https://github.com/SAP-samples/abap-cheat-sheets/blob/main/18_Dynpro.md) places screen layout editing in Screen Painter in ABAP Workbench, and says classic dynpros cannot be created in ABAP Cloud. [SAP Screen Painter documentation](https://help.sap.com/saphelp_snc70/helpdata/en/d1/801b5d454211d189710000e8322d00/content.htm?no_cache=true) describes the existing editor.

For an existing classic ABAP system, open the program/function group in ABAP Workbench, use Screen Painter (SE51) for the required screen, edit its layout/attributes/flow logic, then save and activate using that system's normal transport process. These MCP tools can read the related ABAP program and function-group source.

[Issue #17](https://github.com/mario-andreschak/mcp-abap-adt/issues/17) remains open. No supported ADT endpoint for writing screen layouts was established from the primary sources reviewed on 2026-09-06. Absence of a documented endpoint in this review is not proof that every SAP release lacks one.

A future screen-writing adapter needs a supported interface for the target SAP release (or a customer-approved SAP GUI workflow), fixtures for layout/flow-logic round trips, object locks and transport handling, activation/error reporting, and acceptance in a disposable development system. This repair does not claim that enhancement is implemented, and does not substitute an unverified URL or an unreleased ABAP function module.
