---
name: developer-documentation
description: >-
  Create, restructure, or maintain MongoScope developer documentation (Fumadocs
  MDX under docs/content/docs/). Use when writing or editing README, overview,
  quickstart, tutorial, how-to, concept, reference, CLI, installation,
  troubleshooting, migration, release notes, or the docs site content.
metadata:
  version: "1.0.0"
  upstream: "https://github.com/NateBJones-Projects/developer-documentation-skill"
---

# Developer documentation

Create documentation that helps the intended reader understand or use the real system without needing its author beside them.

Adapted from [NateBJones-Projects/developer-documentation-skill](https://github.com/NateBJones-Projects/developer-documentation-skill) (`CC BY 4.0`; see [LICENSE](LICENSE) and [ATTRIBUTION.md](ATTRIBUTION.md)).

## MongoScope docs layout

| Path | Role |
| ---- | ---- |
| `docs/content/docs/*.mdx` | Product docs pages (Fumadocs MDX) |
| `docs/content/docs/meta.json` | Sidebar order and section dividers |
| `docs/README.md` | Docs package front door (dev/build) |
| Root `README.md` | Repo front door (install + TUI quickstart) |

Page frontmatter: `title`, `description`. Prefer existing Fumadocs components (`Cards`, `Card`, callouts) when the surrounding pages already use them.

Fumadocs uses frontmatter `title` as the page H1 — do **not** add a duplicate `#` heading in the MDX body. Start body sections at `##`. Link between docs with site paths (`/docs/installation`), not relative filesystem paths.

Verify behavior from the TUI/CLI (`src/`, `package.json` scripts, `--help`), not from memory. Live tabs need a reachable MongoDB; static log analysis does not.

## Establish the documentation contract

Before writing:

1. Read the user's request and project instructions (`AGENTS.md`, `docs/AGENTS.md`).
2. Inspect the current code, tests, configuration, CLI help, and existing docs that define behavior.
3. Identify the reader, the job they need to complete, the output path, and the format (usually MDX under `docs/content/docs/`).
4. Separate current behavior from proposed behavior. Do not document a proposal as an implemented feature.
5. Preserve unrelated documentation and user changes.

Use current product behavior as the source for product claims. If a material claim cannot be verified, label the limitation instead of filling the gap.

## Choose the right document type

Create only the pages the reader needs. Do not turn every request into a full documentation site.

Common forms:

- **Overview** — what the system is, who it is for, where to start (`index.mdx`).
- **Quickstart** — shortest path to a first useful result (`getting-started.mdx`).
- **Tutorial** — guided learning through a coherent sequence.
- **How-to** — one practical goal for an informed reader.
- **Concept** — mental model, design rationale, behavior explanation (`indexing-guide.mdx`).
- **Reference** — exact interface, fields, commands, defaults, constraints (`cli.mdx`, `shortcuts.mdx`, `themes.mdx`).
- **CLI** — command hierarchy from the parser / `--help`.
- **Installation / setup** — environments, steps, verification, update, removal (`installation.mdx`).
- **Troubleshooting** — observable symptoms → diagnose → resolve → verify.
- **Migration / release notes** — user-visible change, breaking changes, required action.

Read [documentation types](references/documentation-types.md) when the request spans several pages, the form is unclear, or information architecture must change.

## Build the documentation set

For a multi-page set:

1. Choose one entry page (`index.mdx` for the docs site).
2. Give each page one primary reader job.
3. Put the shortest useful path near the entry point.
4. Separate learning, task, explanation, and exact reference when combining them makes the page hard to scan.
5. Link related pages with descriptive text (Fumadocs paths like `/docs/installation`).
6. Update `meta.json` when pages are added, removed, or reordered.

Do not copy the same procedure across several pages. Keep one maintained procedure and link to it.

## Write procedures

State prerequisites before the steps. Use numbered steps when order matters and bullets when it does not.

For each step:

1. Start with the action.
2. State the tool, screen, directory, or environment before the action when that context matters.
3. Put one main action in each step.
4. Explain placeholders immediately after the example that uses them.
5. State the expected result when it helps the reader continue or verify success.
6. Mark an optional step with `Optional:` at the start.

Prefer one supported path. Add alternatives only when different readers genuinely need them.

## Write reference documentation

Organize reference around the public interface (TUI tabs, CLI flags, keybindings), not the source file layout. Derive names, defaults, and constraints from the implementation.

For CLI reference:

- distinguish required, optional, and mutually exclusive inputs;
- show valid values and defaults;
- explain side effects and permission requirements;
- include representative success output when it improves use;
- do not expose unsupported internal details.

## Create usable examples

Make examples minimal, runnable, and safe to copy. Use placeholders for secrets and user-specific values. Introduce each code block with its purpose. Add a language identifier when known.

Never put real credentials in examples. Session-only `--uri` / `--host` connects are ephemeral and not saved to the keychain — document that accurately when relevant.

## Apply the writing standard

Project-specific terminology and style take priority. Otherwise follow [the developer documentation writing standard](references/writing-standard.md).

Use sentence-case headings, direct procedures, active voice, second person, American English, and one consistent term for each thing. Use code font for filenames, commands, flags, fields, keys, and text the reader must enter. Remove promotional claims, filler, and fake certainty.

## Verify the result

From `docs/`:

```bash
bun run lint
bun run types:check
# optional full render check
bun run build
```

For Markdown/MDX structure (fences, image alt, relative file links), the bundled validator can help on individual files:

```bash
python3 .agents/skills/developer-documentation/scripts/validate_docs.py path/to/page.mdx
```

Treat H1 and `/docs/...` link failures as expected for Fumadocs pages (title lives in frontmatter; site paths are not filesystem relatives). Prefer `bun run build` in `docs/` as the source of truth for navigation and broken routes. The validator cannot prove technical accuracy — check claims against the real CLI/TUI.

## Finish the work

Deliver docs at the requested path. Report what changed, how it was checked, and any behavior that remains unverified. Do not report a draft as published or an untested procedure as working.
