# Security policy

## Supported versions

Security fixes land on `main` and ship in the next release. Only the [latest release](https://github.com/prodioslabs/mongoscope/releases/latest) is supported; upgrade by re-running the installer.

## Report a vulnerability

Do not open a public issue, discussion, or pull request for a security problem.

1. Open a private report: [Report a vulnerability](https://github.com/prodioslabs/mongoscope/security/advisories/new) (repository **Security** tab → **Report a vulnerability**).
2. If that form is unavailable, email `hello@prodios.com` with "MongoScope security" in the subject.

Include:

- Output of `mongoscope --version` and your OS / architecture
- How MongoScope was installed (curl installer, release archive, or from source)
- Steps to reproduce and the impact you observed

Redact connection strings, passwords, hostnames, and real log content. Maintainers will confirm receipt, work on a fix in the private advisory, and credit you in the published advisory unless you prefer otherwise.

## Areas in scope

| Area               | Why it matters                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Credential storage | Saved connection secrets go to the OS keychain (`Bun.secrets`), or plaintext in `config.json` as a fallback |
| sudo elevation     | Welcome can run short-lived `sudo -- ls` / `sudo -- tail` to read root-owned logs                           |
| Server writes      | Live Ops kill-op (`killOp`) and Slow Queries profiler enable (`profile: 1` + `slowms`)                      |
| Installer          | `install.sh` downloads release archives and verifies them against `checksums.txt`                           |
| Exports            | Slow Queries export writes query shapes and values to local files                                           |
| Log parsing        | Untrusted log files are parsed on the local machine                                                         |

Vulnerabilities in MongoDB itself, Bun, or OpenTUI belong with those projects.
