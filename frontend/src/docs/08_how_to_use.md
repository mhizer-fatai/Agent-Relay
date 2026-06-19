# 08 - How to Use: API, SDK, Server, CLI & Plugins

This guide covers all the ways to integrate and interact with AgentRelay: REST API endpoints, the client SDK, backend server configurations, the command-line interface (CLI), and framework plugins.

---

## 1. Getting an API Key

Before using the Python package or TypeScript integrations, you must obtain a developer API key to authenticate requests.

1. Open the AgentRelay Dashboard (by default at `http://localhost:5173`).
2. Connect your Sui wallet or log in with your credentials.
3. Navigate to the **Auth/Credentials** tab in the top navigation menu.
4. Copy your live developer API key (e.g., `ar_live_...`). If you need a new key, click **Rotate API Key** to invalidate the previous one and generate a new one.
5. Set it in your local environment file or environment variable:
   ```bash
   export AGENTRELAY_API_KEY="ar_live_your_copied_key_here"
   ```

---

## 2. Client SDK Integration

The AgentRelay client SDK facilitates local operations, cache synchronization, and Move transaction assembly.

### Installation
Install the SDK package using standard package managers:
```bash
npm install @agentrelay/sdk
```

### Initialization (JavaScript / TypeScript)
Configure the client with Sui RPC endpoints and Walrus gateway URLs:
```typescript
import { AgentRelayClient } from "@agentrelay/sdk";

const client = new AgentRelayClient({
  suiRpcUrl: "https://fullnode.testnet.sui.io:443",
  walrusServerUrl: "http://localhost:3000",
  contractPackageId: "0x9d3d5bcc0f72d498b7acb18057f8e2b9fde36abe37f9da986d767107f52b1314",
  marketplaceId: "0xa48a4654d2ed86941c2d69ebb29f147c74d7af6c4e30a15079ba2f21c52e3fd9"
});
```

### Load & Synchronize State
Use the client to fetch or save cognitive vectors during execution loops:
```typescript
// Restore agent state
const { state } = await client.restore("my-audit-agent");

// Update agent state
const updatedContext = {
  last_action: "verified_move_contract",
  confidence: 0.99
};
await client.remember("my-audit-agent", updatedContext);
```

---

## 3. CLI Command Reference

The AgentRelay CLI allows developers to manage agent memory, configure authentication keys, synchronize states, and trigger state branching directly from their terminal using the `ar` command.

### Initialize Workspace Name
Set up the name inside your local project directory. This creates a local config file mapping the current workspace.
```bash
ar init --name agent-sui-auditor
```
* **Parameters:**
  * `--name`: The unique developer name for the agent workspace.

### Dashboard Login
Authenticate your terminal session using your web dashboard profile:
```bash
ar login
```
This opens your default web browser to authorize the CLI session using your registered profile.

### Commit Memory Snapshot
Commit a local agent state JSON file to Walrus (encrypted by default):
```bash
ar commit "Sync active progress" state.json --ver 1.0.0 --importance 5 --visibility pb
```
* **Parameters:**
  * `message`: Brief description of the snapshot.
  * `file`: Path to the local file containing the memory logs/JSON state.
* **Options:**
  * `--ver`: Version tag for the memory file.
  * `--importance`: Importance score (1-10).
  * `--visibility`: Visibility mode: `pr` (private, encrypted) or `pb` (public, unencrypted). Defaults to `pr`.

### Recall Memory State
Fetch and decrypt the latest memory file, printing the formatted system memory injection context:
```bash
ar recall
```
To output the raw decrypted JSON memory file instead of the formatted text:
```bash
ar recall --raw
```

### Fork Agent Memory
Create a child agent memory copy that inherits the exact state of a parent memory file:
```bash
ar fork agent-sui-auditor --name auditor-subtask-01
```
* **Parameters:**
  * `parent_name`: The name of the parent agent state to clone.
  * `--name`: Unique name for the child branch.

> [!IMPORTANT]
> **Permission Guard:** Forking another developer's private memory is blocked because you do not have their decryption keys. You can only fork memories that are marked as Public (`--visibility pb` on commit) or owned by your authenticated developer profile.

---

## 4. REST API Endpoints

Developers can interact with the memory list using standard HTTP REST endpoints, enabling persistence in any programming language.

### Sync Agent Memory State
Saves updated memory files to the local cache and coordinates ledger commits.
* **Endpoint:** `POST /api/agents/sync`
* **Headers:** `Content-Type: application/json`
* **Request Payload:**
  ```json
  {
    "name": "my-audit-agent",
    "ownerEmail": "developer@agentrelay.dev",
    "currentBlobId": "walrus-blob-12345",
    "parentBlobId": null,
    "suiObjectId": "0x9d3d5b..."
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Memory synchronized successfully.",
    "agent": {
      "name": "my-audit-agent",
      "current_blob_id": "walrus-blob-12345"
    }
  }
  ```

### List Swarm Agents
Retrieves all active agents associated with a developer account.
* **Endpoint:** `GET /api/agents/list?email={email}`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "agents": [
      {
        "name": "my-audit-agent",
        "current_blob_id": "walrus-blob-12345",
        "owner_username": "ar_dev"
      }
    ]
  }
  ```

---

## 5. Server Deployment & Database Configuration

The backend server is an Express.js application acting as a proxy gateway between local runtimes, the database, and the Walrus storage cache.

### Backend Configuration
Set configuration variables in the server's `.env` file:
```bash
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-key
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

### Database Schema Setup
The server maps developer identities and synchronizations in a PostgreSQL relational database. Key tables include:
* **users:** Stores registered emails, addresses, usernames, and rotated API keys.
* **agents:** Caches active agent names, current Blob IDs, and parent pointers for quick search lookups.
* **listings:** Tracks marketplace listings and pricing.

---

## 6. Framework Plugins

Integrate AgentRelay's secure persistent memory module (`agentrelay-memory`) into AI agent frameworks.

### Python Package Installation
Install the unified integration library from PyPI:
```bash
pip install agentrelay-memory
```

### LangChain Integration
The `agentrelay.langchain.Memory` class implements LangChain's `BaseChatMessageHistory` interface. It transparently synchronizes agent chat history with Walrus.

```python
import os
import agentrelay
from langchain_core.messages import HumanMessage, AIMessage

# Initialize chat message history
history = agentrelay.langchain.Memory(
    agent_name="sui-assistant-agent",
    api_key=os.getenv("AGENTRELAY_API_KEY"),
    visibility="pr", # 'pr' for private encrypted, 'pb' for public unencrypted
    backend_url="http://localhost:3000"
)

# Add messages to the active memory thread
history.add_message(HumanMessage(content="What is the Sui Network?"))
history.add_message(AIMessage(content="Sui is a high-performance Layer 1 blockchain built with Move."))

# Retrieve loaded message history
print(history.messages)
```

#### How It Works
* **Initialization**: Automatically calls the backend `recall` route (`/api/agents/recall/<agent_name>`) to retrieve state from Walrus and deserialize it into LangChain message objects.
* **Saving States**: Append calls serialize the thread history to JSON, send a POST sync request to the backend, and commit the state.
* **Visibility**: `"pr"` encrypts payloads client-side before storage, while `"pb"` uploads unencrypted JSON.

### Scaling Configuration (Optional)
Enable database caching, thread-locking, token-summarization, and background uploads for high-scale environments:

```python
import os
import agentrelay

memory = agentrelay.langchain.Memory(
    agent_name="my-scale-agent",
    
    # 1. Database caching (PostgreSQL or local SQLite file)
    connection_string="postgresql://username:password@localhost:5432/my_db",
    sync_interval=5,         # Sync to Walrus every 5 messages
    
    # 2. Prevent context overflows by dynamic summarization
    max_token_limit=2000,    # Summarize history when limit is exceeded
    
    # 3. Prevent concurrency race conditions
    enable_locking=True,     # Use process-level locks during write-access
    
    # 4. Perform slow uploads on separate background threads
    async_backup=True        # Perform slow Walrus uploads in a background thread
)
```

### CrewAI Swarm Integration
The `agentrelay.crewai.Tool` allows multiple agents in a swarm crew to share context, facts, and memories by committing and recalling data blocks from Walrus.

```python
import os
from crewai import Agent, Crew, Task
import agentrelay

# Initialize memory management tool
memory_tool = agentrelay.crewai.Tool(
    api_key=os.getenv("AGENTRELAY_API_KEY"),
    backend_url="http://localhost:3000"
)

# Assign the tool to a swarm agent
researcher = Agent(
    role="Research Specialist",
    goal="Gather memory from database and write reports",
    backstory="You have access to long-term memory",
    tools=[memory_tool]
)
```

#### How It Works
* **Validation**: The tool inherits from CrewAI's `BaseTool` and validates input using `AgentRelayMemoryInput` (expects `name`, `action`, and `context`).
* **Execution**: Agents dynamically call `remember` or `recall` to commit findings or retrieve historical context during tasks.

### AutoGen Integration
The `agentrelay.autogen.Manager` provides an automatic turn-based synchronization callback hook, plus a standard tool format for manual memory check-ins.

```python
import os
import autogen
import agentrelay

# Initialize the AutoGen memory manager
manager = agentrelay.autogen.Manager(
    agent_name="my-autogen-agent",
    api_key=os.getenv("AGENTRELAY_API_KEY"),
    visibility="pb"
)

# Instantiate the AutoGen agent
assistant = autogen.AssistantAgent(
    name="assistant",
    llm_config={"config_list": [{"model": "gpt-4", "api_key": "YOUR_OPENAI_API_KEY"}]}
)

# Register the automatic synchronization handler
manager.register_auto_sync(assistant)
```

#### How It Works
* **Auto-Reply Interceptor**: Registers a reply hook. Every conversation turn is intercepted, compiled into an episodic frame, and posted to the memory backend.
* **Manual Tool Calls**: `manager.get_memory_tool()` returns a callable function registered with the agent for manual `remember`/`recall` actions.

### Eliza Integration
Eliza uses database adapters for state. The `AgentRelayElizaAdapter` intercepts state creations to securely snapshot active room sessions.

```typescript
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { AgentRelayElizaAdapter } from "./plugins/eliza-plugin";

// Wrap your database connection adapter
const baseDb = new SqliteDatabaseAdapter();
const db = new AgentRelayElizaAdapter(
  baseDb,
  "eliza-agent-uuid-string",
  process.env.AGENTRELAY_API_KEY,
  "http://localhost:3000"
);
```

#### How It Works
* **Adapter Wrapping**: Wraps a native Eliza database adapter.
* **Write Hook (`createMemory`)**: Intercepts writes, queries the last 50 room messages, and commits the state.
