# DetectObjectTypeListArray

**Purpose:** Batch detection of ABAP object types by array.

**Parameters:**
- `objects` (array, required): Array of objects to detect.
  - Each object:
    - `name` (string, required): Object name.
    - `type` (string, optional): Object type.

**Example:**
```json
{
  "objects": [
    { "name": "ZCL_MY_CLASS" },
    { "name": "ZFM_MY_FUNC", "type": "FUNCTIONMODULE" }
  ]
}
```

---

# DetectObjectTypeListJson

**Purpose:** Batch detection of ABAP object types by JSON payload.

**Parameters:**
- `payload` (object, required): JSON object containing objects array.
  - `objects` (array, required): Array of objects to detect.
    - Each object:
      - `name` (string, required): Object name.
      - `type` (string, optional): Object type.

**Example:**
```json
{
  "payload": {
    "objects": [
      { "name": "ZCL_MY_CLASS" },
      { "name": "ZFM_MY_FUNC", "type": "FUNCTIONMODULE" }
    ]
  }
}
