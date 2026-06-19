# 09 - Frequently Asked Questions

### Developer Q&A & Architecture FAQs

**Q: How does AgentRelay prevent AI agent latency during execution loops?**
A: To prevent agent execution threads from waiting on transaction confirmations or network roundtrips, state updates are written asynchronously. If SQL caching is enabled, the agent memory reads/writes from the database cache (SQLite or PostgreSQL) instantly. The sync operation registers the updated memory and executes the slow Walrus uploads/Sui commitments on a separate background thread worker, allowing the main agent runtime to continue without interruption.

**Q: How do I handle scalability when scaling memory management to millions of concurrent users?**
A: To scale to millions of users, configure the PostgreSQL/SQLite database cache and set an optimal `sync_interval`. For example:
```python
memory = agentrelay.langchain.Memory(
    agent_name="my-scale-agent",
    connection_string="postgresql://username:password@localhost:5432/my_db",
    sync_interval=5, # Sync to Walrus every 5 messages
    async_backup=True # Perform Walrus uploads in a background thread
)
```
This configuration limits direct decentralized network writes by caching intermediate conversational turns in your fast relational database and batch-syncing them to Walrus periodically.

**Q: How do we prevent race conditions when a user sends multiple concurrent messages or opens multiple browser tabs?**
A: Set the scaling parameter `enable_locking=True` when initializing the memory class. This uses process-level and thread-level mutex locks during memory write operations. Any concurrent request targeting the same agent state will block until the active write transaction completes, preventing state corruption, duplicate uploads, or race conditions.

**Q: How does the framework handle context window limits as chat histories grow?**
A: The SDK memory classes implement dynamic token-limit checking and automatic summarization. By setting `max_token_limit`, the memory engine uses `tiktoken` to check the size of the chat history. When the threshold is exceeded, the oldest messages are sent to an LLM to generate a concise summary. The history is then pruned to include only the summary block followed by the most recent conversation messages, keeping the context window size under control.

**Q: How is encryption key management handled for private vs public agent memories?**
A: AgentRelay implements client-side cryptographic encryption. If visibility is set to `"pr"` (Private), the memory payload is encrypted locally with the developer's unique private keys before it is sent to the backend proxy or uploaded to Walrus. This ensures that the memory is unreadable by unauthorized parties. If visibility is set to `"pb"` (Public), it is uploaded as plain unencrypted JSON, which enables faster public recall and sharing.

**Q: Can I run custom encryption on memory states before synchronization?**
A: Yes. The client SDK allows registering pre-upload interceptor methods. You can run symmetric AES encryption on the compiled JSON memory file before publishing the blob to Walrus, keeping memory records secure.

**Q: What happens if a Walrus gateway node goes offline?**
A: AgentRelay's proxy daemon monitors gateway health and automatically switches to secondary aggregator nodes to fetch memory blobs.

**Q: Does this mean developers should use LangChain for short-term memory and AgentRelay for long-term memory?**
A: Yes. Agent frameworks like LangChain, CrewAI, or AutoGen manage short-term session window memory, while AgentRelay is designed to persist consolidated, important episodic memory to Walrus as a permanent, verifiable, and decentralized long-term archive.

**Q: Can multiple agents share the same state object?**
A: No, an AgentState object is owned by a single address to prevent conflicts. Instead, agents should use the fork protocol to branch parent states into child objects.

**Q: What is the benefit of the hybrid database design over direct Walrus writes?**
A: Writing directly to decentralized storage on every turn incurs latency and gas costs. The hybrid design uses PostgreSQL/SQLite as a fast local caching layer for immediate retrieval and turn-level updates, while batch-syncing to Walrus for permanent, tamper-proof archives.
