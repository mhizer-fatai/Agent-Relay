# AgentRelay: Sovereign Persistent Memory for AI Agents

AgentRelay is a decentralized, sovereign persistent memory protocol for autonomous AI agents. It enables agents to retain, transfer, and inherit cognitive state across sessions, frameworks, and LLM providers. Memories are stored securely as encrypted blobs on the **Walrus Testnet** and indexed on the **Sui blockchain**.

---

## 🚀 Key Features

* **True Client-Side Privacy:** Memory payloads are encrypted locally on the client (Python/JS SDKs) using developer-managed symmetric keys before upload. Your keys never leave your runtime environment.
* **Gasless Off-Chain Commits:** Decoupled memory updates from active block times. Memories are synced directly to Walrus Testnet with metadata indexed on-chain—minimizing latency and transaction fees.
* **Namespaced & UUID Identification:** Avoid naming conflicts. Agents are identified by unique database UUIDs or namespaced aliases (`username/agent-name`).
* **Multi-Framework Integrations:** First-class SDK integrations for **LangChain** (`AgentRelayChatMessageHistory`), **AutoGen** (`AgentRelayAutoGenManager`), and **CrewAI** (`AgentRelayCrewMemoryTool`).
* **Interactive Memory Dashboard:** A premium, mobile-responsive Web UI to inspect cognitive states, manage API keys, and copy memory/blob IDs.
* **Memory Marketplace:** A marketplace where developers can publish, buy, or license specialized agent memories (e.g., trading strategies, vulnerability definitions) using SUI coins.

---

## 📂 Repository Structure

* `agentrelay/` - Core Python SDK and framework wrappers (LangChain, AutoGen, CrewAI).
* `sdk/` - TypeScript/JavaScript Client SDK.
* `cli/` - Command-line interface tool for developer authentication.
* `backend/` - Node.js Express server acting as the metadata registry and Walrus proxy (linked to Supabase).
* `frontend/` - React/Vite dashboard, visual memory file inspector, and docs portal.
* `move/` - Sui Move smart contracts representing the intelligence registry and marketplace.
* `plugins/` - Reusable integration layers for agent frameworks.

---

## 🛠️ Quick Start

### Python SDK

Install the package and use it to wrap your agent memory:

```python
from agentrelay import AgentRelayMemoryEngine

# Initialize the secure memory engine
engine = AgentRelayMemoryEngine(
    agent_name="my-trading-agent",
    api_key="your-developer-api-key",
    decryption_key="your-secure-symmetric-passphrase"
)

# Load existing memory state from Walrus
memory_state = engine.get_memory()

# Update and securely sync memory to Walrus
memory_state["semantic"].append({
    "entity": "market_trend",
    "fact": "Sui transaction volume increased by 200%",
    "confidence": 0.98
})
engine.save_memory(memory_state)
```

#### Integrating with LangChain

```python
from agentrelay.langchain import AgentRelayChatMessageHistory

chat_history = AgentRelayChatMessageHistory(
    agent_name="my-langchain-agent",
    decryption_key="your-passphrase"
)

# Chat messages automatically encrypt, save to Walrus, and persist across runs
chat_history.add_user_message("Analyze the latest Move smart contract.")
```

### TypeScript SDK

```typescript
import { AgentRelayClient } from "@agentrelay/sdk";

const client = new AgentRelayClient({
  walrusServerUrl: "https://your-agentrelay-backend.com",
});

// Decrypt and load memory state by Walrus Blob ID
const state = await client.recall("your-walrus-blob-id", "your-decryption-key");
```

---

## 💻 Local Development

### 1. Run the Backend
```bash
cd backend
npm install
# Set up database credentials in .env (see .env.example)
npm start
```

### 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📜 License
This project is licensed under the MIT License.
