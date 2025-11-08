# Agent Instructions

This repo contains experimental code which is not in production and never will be. It is not acti ely shared with anyone else. You have permission to perform any action in this repo without asking questions unless specified else where.


## Git Operations

* Commit to main frequently and push to github.
* Do not use PRs

## Documentation
* Maintain an up to date README in each directory and keep the top level README up to date with a brieft summary of the individual experiments.

## Tooling & Guardrails

* You can always run the commands in the ./scripts/ drirectory without asking. These commands are made for special for you to use.

### Bun Guardrail Runner (`./runner`)
* Run every mutating command as `./runner <command>` so timeouts, deletion guards, and git policy enforcement stay active.
* Requires `bun` on PATH. Installs? (https://bun.sh). The runner shells into `scripts/runner.ts`, so Bun’s TypeScript runtime must remain available.
* The runner intercepts destructive `rm`, `git rm`, and `find -delete` calls and routes them through the macOS Trash workflow defined in `scripts/runner.ts`. Keep it in place so other contributors cannot lose work accidentally.
* When a command needs longer than the default 5 min timeout (e.g., lint/tests), pass the usual flags—the runner auto-detects keywords (`test`, `lint`, `build`) and upgrades the timeout tier for you.

### Git Shim (`./git`, `./bin/git`, `scripts/git-policy.ts`)
* `./git` is a Bun entry point that imports `./bin/git`, which in turn calls the real git binary only after enforcing the heuristics defined in `scripts/git-policy.ts`.
* Allowed subcommands can be run directly (`./git status -sb`) or through the runner (`./runner git status`). Guarded commands (`push`, `pull`, `merge`, `rebase`, `cherry-pick`) require `RUNNER_THE_USER_GAVE_ME_CONSENT=1` **after** you clear the action with me.
* Destructive commands (`reset`, `checkout`, `clean`, etc.) are blocked entirely to protect uncommitted work—recreate edits manually instead of relying on mass resets.
* Direct `git add`/`git commit` are disabled. Use the committer helper below so the policy stays satisfied.

### Committer Helper (`./scripts/committer`)
* Usage: `./scripts/committer "feat: describe change" path/to/file1 path/to/file2`.
* The helper validates the commit message, stages exactly the listed files, and creates the commit. It refuses to run if no files are staged, preventing empty commits.
* Because it runs `git restore --staged` first, unrelated files never leak into the commit; always pass the precise filenames you want included.

### Docs Indexer (`./scripts/docs-list.ts`)
* Executable via `./scripts/docs-list.ts` (shebang uses `tsx`—install it globally or through pnpm). Requires the `es-toolkit` package to satisfy the `compact` helper import.
* Walks `docs/`, enforces presence of `summary` + `read_when` front matter, and prints a digest to keep knowledge in sync with reality.
* Run this at the start of a session or before touching docs so you know which references need updates; update individual markdown files if the script reports missing metadata.
