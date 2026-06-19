# 03 - Architecture & System Design

AgentRelay uses a three-tier decoupled structure to isolate model reasoning from cognitive memory storage and validation lists.

### 1. The Execution Layer (Agent Runtime)
The reasoning cycle runs inside the developer's execution sandboxes (e.g. Langchain, CrewAI, AutoGPT). The agent reads its tasks, performs operations, and generates state changes. Instead of maintaining local states in raw text or in-memory variables, the runtime compiles updates into structured JSON memory vectors.

### 2. The Storage Layer (Walrus Caching Node)
Heavy data structures (like memory logs, vector embeddings, and knowledge maps) are compressed and uploaded as decentralized blobs to Walrus storage nodes. The local AgentRelay backend maintains a high-speed Walrus read/write cache to support sub-second recovery and sync requests during live loops.

### 3. The Ledger List Layer (Sui Blockchain)
Sui anchors state verification. When the agent updates its memory on Walrus, the new Walrus Blob ID is sent to the Sui blockchain. A Move smart contract commits the verification hash to the agent's ledger list object. This provides:
* **Cryptographic Timelines:** An immutable history of state mutations.
* **Race Condition Prevention:** Resolves overlapping state updates during parallel agent execution.
* **Access Control:** Enforces that only authorized owner signatures can execute state updates.

### 11. Production-Ready Dynamic Configurations
* **Vite Env Resolution:** Swapped the hardcoded frontend backend URL in `App.tsx` for `import.meta.env.VITE_BACKEND_URL` with a local dev fallback.
* **CLI Env Routing overrides:** Configured `cli/bin/index.js` to look for `AGENTRELAY_BACKEND_URL` and `AGENTRELAY_DASHBOARD_URL` environment variables first, allowing commands to connect to custom host domains.
* **Backend CORS Security:** Replaced open wildcard access with a restricted CORS policy in `backend/server.js` that checks the `ALLOWED_ORIGINS` environment variables list.

### 12. Marketplace Decryption Key Display & Action Panel
* **Key Preservation State:** Added a state variable to track purchased memory pack keys (`purchasedKeys`) pre-populated with the default `pack-defi-trader` key.
* **UI Action Toggle:** Replaced the "Purchase & Load" CTA button on purchased items with a collapsible section toggled via a "Show Decryption Key" / "Hide Decryption Key" button.
* **Collapsible Key Container:** Implemented a panel showing the key value with an interactive clipboard copy utility that updates dynamically to "Copied" for active user feedback.
* **Emoji Sanitization:** Sanitized emojis from the updated logs to comply with the zero-emojis rule.

