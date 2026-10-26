# Native HTTPS archive

On 2026-10-26 the owner requested removing native HTTPS from the main development
line as part of the security-drift cleanup. The supported CLI serves HTTP on
loopback; its former certificate/key options are no longer accepted.

The implementation from [PR #139](https://github.com/gregoryyy/kibitz/pull/139)
remains in the [secdrift branch](https://github.com/gregoryyy/kibitz/tree/secdrift).
The [secdrift-native-https tag](https://github.com/gregoryyy/kibitz/tree/secdrift-native-https)
preserves exact pre-removal main commit
`da4ac715e043fe9b6bd502793b5d092d79f693e6`, including #139's final assurance repair
and merge. Its [historical setup guide](https://github.com/gregoryyy/kibitz/blob/secdrift-native-https/docs/TLS.md)
and tests are archival evidence, not current setup instructions or an approved
release configuration.

This rollback does not migrate cookies, browser origins or private databases.
Keep private-library/profile backups and preserve ownership cookies; clearing one
can lose access to its collection. Reassess product scope and data compatibility
before extracting any archived change.

[Deployment](DEPLOYMENT.md) describes the current local app. TODO 11.4.2.7.1 is
deferred; transport and other ASVS requirements remain unsatisfied, pending a new
scope decision. Existing handler-level TLS tests and provider HTTPS connections
do not supply a native CLI listener.
