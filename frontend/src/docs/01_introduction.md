# 01 - Protocol Introduction

The rapid rise of autonomous agent frameworks (such as CrewAI, LangChain, and AutoGPT) has highlighted a major limitation in modern artificial intelligence runtimes: **cognitive statelessness**. Because Large Language Models (LLMs) operate as mathematical functions mapping inputs to outputs on a per-token basis, they have no built-in persistence layers. 

AgentRelay addresses this challenge by establishing a **Decentralized Memory Protocol**. It separates the execution logic of LLM runtimes from their memory data layers. This allows agents to persist logs, facts, and tools across sessions, network crashes, and model migrations.

### Architecture Highlights

* **Decoupled Memory Runtimes:** Execution loops manipulate local states and sync to the protocol without runtime library lock-in.
* **Walrus Storage Network Integration:** Large datasets (including full conversation chains, context indexes, and skills definitions) are compiled into JSON memory files, compressed, and written as decentralized blobs to Walrus storage nodes.
* **Sui Blockchain Anchoring:** Cryptographic proof hashes (Blob IDs) are committed to the Sui ledger, building a single source of truth that prevents race conditions and state tampering.
* **Sovereign Machine Identity:** Runtimes claim on-chain identity nodes, enabling secure peer-to-peer memory trading, skill sharing, and permissioned state inheritance.

