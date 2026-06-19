# AgentRelay Persistent Memory Skill

Allows the OpenClaw agent to programmatically backup, restore, and fork its memory files using the AgentRelay secure terminal CLI.

## Description
This skill provides the AI agent with direct capability to manage its long-term state. When running tasks that require multi-turn tracking, the agent should periodically serialize its active status context, encrypt it locally, and back it up.

## CLI Tools Exposed

### 1. ar_commit
- Command: `ar commit "<message>" <file_path> [--ver <version>] [--importance <score>]`
- Description: Encrypts the local state file and uploads the memory blob to Walrus, updating the blockchain list mapping.

### 2. ar_recall
- Command: `ar recall [--raw]`
- Description: Fetches the latest memory state memory file from the network aggregator, decrypts it, and returns the compiled prompt instructions or JSON output.

### 3. ar_fork
- Command: `ar fork <parent_name> --name <child_name>`
- Description: Creates a child branch memory copy of an existing agent memory root.

## Instructions for the LLM
1. **At Startup**: Run `ar recall` to retrieve the latest state context from your previous run. Inject these facts, logs, and intents into your active memory loop.
2. **On Action Completion**: After finishing a task, or when experiencing an error, write the current execution status (goals, logs, and variables) into `state.json`.
3. **Commit State**: Execute `ar commit "Sync state" state.json` to save the active workspace memory securely.

