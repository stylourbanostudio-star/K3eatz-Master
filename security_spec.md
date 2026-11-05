# Security Specification

## Data Invariants
- A track must belong to a valid authenticated user.
- A user can only read and write their own profile and tracks.
- Timestamps (`createdAt`, `updatedAt`) must be server-generated.
- Field types must strictly match the schema (e.g., `bpm` must be a number).
- `status` must be one of the predefined values: `pending`, `analyzed`, `mastered`.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create a track with `userId` of another user.
2. **Identity Spoofing**: Attempt to update another user's track settings.
3. **Identity Spoofing**: Attempt to read another user's profile.
4. **Validation Breach**: Create a track with `bpm` as a string instead of a number.
5. **Validation Breach**: Create a track with a missing required field (e.g., `status`).
6. **Validation Breach**: Update `status` to an invalid value like `broken`.
7. **Temporal Integrity**: Create a track with a client-provided `createdAt` date from the past.
8. **Temporal Integrity**: Update a track and attempt to change the `createdAt` date.
9. **Resource Poisoning**: Create a track with a name that is 1MB in size.
10. **ID Poisoning**: Attempt to write to a document with a path containing non-alphanumeric characters.
11. **PII Leak**: Attempt to list all user profiles without being authenticated.
12. **Shadow Field Injection**: Attempt to add a `isVerifiedAdmin: true` field to a user profile.

## Verification
All of the above payloads must result in `PERMISSION_DENIED` by the Firestore security rules.
