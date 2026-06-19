# 05 - Memory Lifecycle & Synchronization

The life of an agent's memory file follows a strict sequence of state transitions to maintain consistency between local runtimes and decentralized storage.

### Phase 1: Bootstrap & Loading
1. The agent runtime initializes and queries the Sui ledger for its target AgentState object.
2. The ledger resolves the current state pointer to a Walrus Blob ID.
3. The local client pulls the matching JSON memory file from the Walrus gateway.
4. The memory file is unpacked and loaded into the agent's active memory.

### Phase 2: Active Reasoning & Mutating
* As the agent runs tasks, it writes logs to its logs timeline.
* Detected rules and properties update the facts network.
* If a task sequence succeeds, the steps are stored in the tools directory.

### Phase 3: Commit & Synchronize
1. The agent completes its task cycle or reaches a synchronization step.
2. The client compiles the local memory updates into a compressed JSON memory file.
3. The compiled memory file is published as a decentralized blob to the Walrus network.
4. The client signs a Sui transaction, updating the list's current state pointer to the new Walrus Blob ID.

### Phase 4: Crash Recovery & Failover
If the agent runtime crashes mid-task, a fallback daemon reads the last validated ledger pointer from Sui, downloads the matching state, and resumes execution without losing core objectives.

