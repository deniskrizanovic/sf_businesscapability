# Plan 02: Import Utility

## Purpose
Allow an admin to load a full capability map from a nested JSON document by pasting it into an LWC textarea. The Apex controller parses the JSON, upserts the Map record, then recursively upserts all Capabilities and their Tags.

## JSON Format

```json
{
  "mapName": "Homes NSW Business Capability Model",
  "mapDescription": "Strategy 2025-2035 capability model",
  "capabilities": [
    {
      "externalId": "domain-1",
      "name": "Portfolio Planning & Development",
      "level": 1,
      "sortOrder": 1,
      "definition": "...",
      "strategySupport": "...",
      "architecturalNuance": "...",
      "tags": ["NEW"],
      "children": [
        {
          "externalId": "domain-1-group-1",
          "name": "Housing Needs Analysis",
          "level": 2,
          "sortOrder": 1,
          "definition": "...",
          "strategySupport": "...",
          "architecturalNuance": "",
          "tags": [],
          "children": [
            {
              "externalId": "domain-1-group-1-cap-1",
              "name": "Waitlist Trend Modelling",
              "level": 3,
              "sortOrder": 1,
              "definition": "...",
              "strategySupport": "...",
              "architecturalNuance": "...",
              "tags": [],
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

**Rules:**
- `mapName` is required and used as the upsert key for `bcm_Map__c` (matched on `Name`)
- `externalId` is required on every capability node and maps to `bcm_ExternalId__c`
- `level` must match the depth implied by nesting (enforced by Apex, not assumed from structure)
- `tags` is an array of tag names; tags are created if they don't exist (with a default grey colour `#CCCCCC`)
- `children` may be empty array or omitted

## Rich Text Fields and Import

`bcm_Description__c` (on Map), and `bcm_Definition__c`, `bcm_StrategySupport__c`, `bcm_ArchitecturalNuance__c` (on Capability) are Rich Text Area fields. Salesforce stores these as HTML internally.

**Decision: the JSON source supplies HTML strings for all rich text fields.** The Apex controller passes these values directly to the field — no transformation is applied. The importer does not accept or convert plain text for these fields.

Example JSON values for rich text fields:
```json
"definition": "<p>A named, persistent ability the business has.</p>",
"strategySupport": "<p>Supports <strong>Strategy 2025–2035</strong> objective 3.</p>",
"architecturalNuance": "<ul><li>Depends on CRM integration</li></ul>"
```

Source data must be prepared with HTML markup before import. Plain text strings without HTML tags will save without error but will render as unstyled text.

## Apex Controller: `bcm_ImportController`

### Method
```apex
@AuraEnabled
public static bcm_ImportResult importCapabilities(String jsonPayload)
```

### Processing Steps
1. **Parse JSON** — deserialise into a typed Apex wrapper class tree
2. **Upsert Map** — `upsert` `bcm_Map__c` by `Name`; capture the Map Id
3. **Collect all Tags** — walk the entire tree, collect unique tag names; `upsert` all `bcm_Tag__c` records by `Name`; build a `Map<String, Id>` of tag name → Id
4. **Flatten capabilities** — walk the tree depth-first, building a flat list of `bcm_Capability__c` sobjects; set `bcm_Map__c`, `bcm_Level__c`, `bcm_SortOrder__c`, `bcm_ExternalId__c`, and all text fields; leave `bcm_Parent__c` as null for now
5. **Upsert capabilities** — `upsert` the flat list by `bcm_ExternalId__c`; capture the resulting `Id` map
6. **Set parent lookups** — for each non-root capability, set `bcm_Parent__c` to the Id of its parent's `externalId`; `update` the list
7. **Build junction records** — for each capability with tags, create `bcm_CapabilityTag__c` records; delete existing junctions for these capabilities first to support re-import; `insert` new junctions
8. **Return result** — return `bcm_ImportResult` with counts of inserted/updated/failed records and any error messages

### Error Handling
- If JSON is malformed: catch `JSONException`, return error message to LWC
- If any DML fails: use `Database.upsert` with `allOrNone = false`; collect errors and include in result
- Import is designed to be **idempotent** — running the same JSON twice produces the same result

### Apex Wrapper Classes
```apex
public class bcm_ImportPayload {
    public String mapName;
    public String mapDescription;
    public List<bcm_CapabilityNode> capabilities;
}

public class bcm_CapabilityNode {
    public String externalId;
    public String name;
    public Integer level;
    public Integer sortOrder;
    public String definition;
    public String strategySupport;
    public String architecturalNuance;
    public List<String> tags;
    public List<bcm_CapabilityNode> children;
}

public class bcm_ImportResult {
    @AuraEnabled public Integer capabilitiesInserted;
    @AuraEnabled public Integer capabilitiesUpdated;
    @AuraEnabled public Integer tagsCreated;
    @AuraEnabled public Boolean success;
    @AuraEnabled public String errorMessage;
}
```

## LWC: `bcm_ImportUtility`

### Template Structure
```
bcm_ImportUtility
├── Header: "Capability Map Import"
├── lightning-textarea (label: "Paste JSON", rows: 20)
├── lightning-button (label: "Import", variant: brand)
├── Spinner (shown during import)
└── Result section (shown after import)
    ├── Success: "Imported X capabilities, Y tags created"
    └── Error: error message in red
```

### JS Controller Responsibilities
- Bind textarea value to a tracked property
- On button click: validate textarea is not empty, call `importCapabilities` imperatively
- Show/hide spinner during async call
- Display result or error message on completion

### Placement
- Dedicated Lightning App Page: `bcm_ImportPage`
- Tab in the `bcm_` app, visible only to users with `bcm_Editor` Permission Set
- Tab label: "Import"

## Governor Limit Considerations
- A full capability map from the source document has approximately 150-200 capability records
- Well within single-transaction DML limits (10,000 rows)
- No need for async/batch processing at this data volume
- If future maps exceed ~500 records, consider chunking the upsert into batches of 200
