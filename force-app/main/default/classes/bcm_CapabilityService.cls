/**
 * Service layer for bcm_Capability__c business operations.
 * Per ADR 0002: services own all DML; controllers delegate.
 */
public with sharing class bcm_CapabilityService {
    /**
     * Persists an allowlisted set of editable fields on a Capability:
     * Name, Definition, Strategy Support, Architectural Nuance, Hide From Diagram.
     *
     * Only fields that are explicitly populated on the input record are written.
     * Fields left null on input are NOT touched on the persisted record — this
     * avoids accidental data loss when callers pass partial deltas. To clear a
     * rich-text or text field, callers must pass an empty string ('') rather
     * than null. (bcm_HideFromDiagram__c is required, since `false` is meaningful.)
     *
     * Uses `update as user` so FLS / CRUD are enforced for the running user.
     * Rejects null input early; lets DML exceptions surface to the caller.
     *
     * @param cap  Capability with Id and at least one editable field set.
     */
    public static void updateCapability(bcm_Capability__c cap) {
        if (cap == null || cap.Id == null) {
            throw new IllegalArgumentException('Capability with Id is required');
        }
        bcm_Capability__c toUpdate = new bcm_Capability__c(Id = cap.Id);
        if (cap.Name != null) {
            toUpdate.Name = cap.Name;
        }
        if (cap.bcm_Definition__c != null) {
            toUpdate.bcm_Definition__c = cap.bcm_Definition__c;
        }
        if (cap.bcm_StrategySupport__c != null) {
            toUpdate.bcm_StrategySupport__c = cap.bcm_StrategySupport__c;
        }
        if (cap.bcm_ArchitecturalNuance__c != null) {
            toUpdate.bcm_ArchitecturalNuance__c = cap.bcm_ArchitecturalNuance__c;
        }
        if (cap.bcm_HideFromDiagram__c != null) {
            toUpdate.bcm_HideFromDiagram__c = cap.bcm_HideFromDiagram__c;
        }
        update as user toUpdate;
    }
}
