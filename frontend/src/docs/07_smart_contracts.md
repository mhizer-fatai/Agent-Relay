# 07 - Move Smart Contracts Specification

The on-chain protocol logic of AgentRelay is implemented as a Move module deployed on the Sui blockchain. It manages memory ownership, updates, and market listings.

### 1. Core Data Structures

```move
struct AgentState has key, store {
    id: UID,
    owner: address,
    current_blob_id: string::String,
    parent_blob_id: Option<string::String>,
    version: u64,
}
```
* **owner:** The address authorized to sign state updates.
* **current_blob_id:** The latest Walrus Blob ID mapping to the JSON memory file.
* **parent_blob_id:** The parent branch ID if this agent was forked.

### 2. Marketplace Modules
The `intelligence_market` module manages memory packages:
* **Listing:** Owners lock their `AgentState` pointer and publish a memory vector listing, specifying a price in SUI.
* **Purchase:** Buyers pay the SUI price to splits and unlock the decryption keys, cloning the state memory file into a new agent branch.
* **Royalties:** Enforces creator royalty cuts on secondary trades.

