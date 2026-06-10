# ADR 0001: Introduce bcm_Map\_\_c as a capability set container

## Status

Accepted

## Context

All `bcm_Capability__c` records in the org share the same object. Without a container, every L1 root node is implicitly part of "the one map". This makes it impossible to maintain multiple independent capability models (e.g. different business units, different versions) in the same org without cross-contamination in queries and the diagram.

## Decision

Introduce `bcm_Map__c` as a first-class object. Every `bcm_Capability__c` record carries a required lookup to a `bcm_Map__c` record. The diagram, import utility, and list views are all scoped to a single selected Map.

## Consequences

- All SOQL queries on `bcm_Capability__c` must filter by `bcm_Map__c`
- The import JSON format includes a top-level `mapName` field; the importer upserts the Map record before processing capabilities
- The `bcm_CapabilityMap` LWC receives a Map ID as an input property
- Tags (`bcm_Tag__c`) are org-wide, not map-scoped — a tag can be applied to capabilities across different maps
