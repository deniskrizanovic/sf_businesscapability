# Spec Delta

## Purpose

Defines which Lightning record page each project object shows inside the Business Capability Map app, and requires that choice to come from source so every org deployed from the repo shows the same pages.

## ADDED Requirements

### Requirement: Capability records open on the custom Capability record page

When a user views a `bcm_Capability__c` record in the Business Capability Map app on desktop, the system SHALL show the custom Capability record page. It has the Tags related list in the sidebar and the Definition rich-text field.

#### Scenario: Editor sees Tags sidebar and Definition field

- **WHEN** an editor opens a Capability record in the Business Capability Map app in an org newly deployed from source
- **THEN** a Tags related list is visible in the sidebar and the Definition field can be edited inline in a rich-text editor

#### Scenario: Viewer sees Tags sidebar without New action

- **WHEN** a viewer opens a Capability record in the Business Capability Map app in an org newly deployed from source
- **THEN** the Tags related list is visible in the sidebar and offers no New action

### Requirement: Tag records open on the custom Tag record page

When a user views a `bcm_Tag__c` record in the Business Capability Map app on desktop, the system SHALL show the custom Tag record page, which includes the colour swatch card.

#### Scenario: Colour swatch shows on Tag record

- **WHEN** an editor opens a Tag record in the Business Capability Map app in an org newly deployed from source
- **THEN** a card titled "Colour" showing the Tag's colour is visible on the page

### Requirement: Record page activation comes from source

Every custom record page activation for a project object SHALL be defined in committed metadata. Deploying the project to an org SHALL be enough to activate the pages, with no Lightning App Builder step.

#### Scenario: New org shows custom pages after deploy only

- **WHEN** the project's `force-app` source is deployed to an org where no record page was ever activated by hand
- **THEN** Map, Capability and Tag records each open on their custom record page in the Business Capability Map app

#### Scenario: Committed app metadata lists every activation

- **WHEN** the committed Business Capability Map app metadata is inspected
- **THEN** it has a desktop View override to the custom record page for each of `bcm_Map__c`, `bcm_Capability__c` and `bcm_Tag__c`
