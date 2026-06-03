/**
 * Service layer for bcm_Capability__c business operations.
 * Per ADR 0002: services own all DML; controllers delegate.
 */
public with sharing class bcm_CapabilityService {

    /**
     * Persists a whitelisted set of editable fields on a Capability:
     * Name, Definition, Strategy Support, Architectural Nuance, Hide From Diagram.
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
        bcm_Capability__c toUpdate = new bcm_Capability__c(
            Id                          = cap.Id,
            Name                        = cap.Name,
            bcm_Definition__c           = cap.bcm_Definition__c,
            bcm_StrategySupport__c      = cap.bcm_StrategySupport__c,
            bcm_ArchitecturalNuance__c  = cap.bcm_ArchitecturalNuance__c,
            bcm_HideFromDiagram__c      = cap.bcm_HideFromDiagram__c
        );
        update as user toUpdate;
    }
}
