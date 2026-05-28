// E2E test user setup — credentials injected at runtime by create-e2e-users.sh
// Do NOT edit the placeholder values; they are replaced from .env before execution.
Profile p = [SELECT Id FROM Profile WHERE Name = 'AutomatedTester - Minimum Access Clone' LIMIT 1];

User editor = new User(
    Username      = '${SF_EDITOR_USERNAME}',
    Email         = '${SF_EDITOR_USERNAME}',
    Alias         = 'bcmedit',
    LastName      = 'Editor',
    FirstName     = 'BCM',
    TimeZoneSidKey    = 'Australia/Sydney',
    LocaleSidKey      = 'en_AU',
    EmailEncodingKey  = 'UTF-8',
    LanguageLocaleKey = 'en_US',
    ProfileId     = p.Id
);
Database.upsert(editor, User.Fields.Username, true);

User viewer = new User(
    Username      = '${SF_VIEWER_USERNAME}',
    Email         = '${SF_VIEWER_USERNAME}',
    Alias         = 'bcmview',
    LastName      = 'Viewer',
    FirstName     = 'BCM',
    TimeZoneSidKey    = 'Australia/Sydney',
    LocaleSidKey      = 'en_AU',
    EmailEncodingKey  = 'UTF-8',
    LanguageLocaleKey = 'en_US',
    ProfileId     = p.Id
);
Database.upsert(viewer, User.Fields.Username, true);

// Re-query to ensure IDs are populated (upsert on existing records may not set .Id)
editor = [SELECT Id, Username FROM User WHERE Username = '${SF_EDITOR_USERNAME}' LIMIT 1];
viewer = [SELECT Id, Username FROM User WHERE Username = '${SF_VIEWER_USERNAME}' LIMIT 1];

System.setPassword(editor.Id, '${SF_EDITOR_PASSWORD}');
System.setPassword(viewer.Id, '${SF_VIEWER_PASSWORD}');

PermissionSet editorPs = [SELECT Id FROM PermissionSet WHERE Name = 'bcm_Editor' LIMIT 1];
PermissionSet viewerPs = [SELECT Id FROM PermissionSet WHERE Name = 'bcm_Viewer' LIMIT 1];

List<PermissionSetAssignment> existing = [
    SELECT Id, AssigneeId, PermissionSetId FROM PermissionSetAssignment
    WHERE AssigneeId IN (:editor.Id, :viewer.Id)
    AND PermissionSetId IN (:editorPs.Id, :viewerPs.Id)
];
Set<String> existingKeys = new Set<String>();
for (PermissionSetAssignment psa : existing) {
    existingKeys.add(psa.AssigneeId + ':' + psa.PermissionSetId);
}

List<PermissionSetAssignment> toInsert = new List<PermissionSetAssignment>();
if (!existingKeys.contains(editor.Id + ':' + editorPs.Id)) {
    toInsert.add(new PermissionSetAssignment(AssigneeId = editor.Id, PermissionSetId = editorPs.Id));
}
if (!existingKeys.contains(viewer.Id + ':' + viewerPs.Id)) {
    toInsert.add(new PermissionSetAssignment(AssigneeId = viewer.Id, PermissionSetId = viewerPs.Id));
}
if (!toInsert.isEmpty()) {
    insert toInsert;
}

System.debug('E2E users created/updated: ' + editor.Username + ', ' + viewer.Username);
