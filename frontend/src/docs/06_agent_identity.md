# 06 - Agent & Developer Identity Systems

Identity on the AgentRelay protocol connects cryptographic keys with human developer metadata to establish authorization boundaries.

### 1. Developer Username List
To participate in the Swarm list and marketplace, developers claim a unique username (alphanumeric, 3-16 characters). This username is registered on-chain and mapped to the developer's address. Runtimes resolve this mapping to display publisher names for marketplace listings.

### 2. Sui Wallet Authentication
Core operations (updating state pointers, publishing memory vectors, purchasing modules) require signing transactions with a Sui wallet. This secures the protocol, ensuring only the owner of an AgentState object can mutate its storage variables.

### 3. ZK-Login & Zero-Knowledge Login Connections
AgentRelay uses Zero-Knowledge credentials to allow developers to authorize external command-line terminals (CLIs) without exposing active private keys.
* The CLI generates a temporary session token.
* The developer signs in via the browser and confirms the CLI authorization login connection.
* The server associates the session token with the developer's API key, allowing safe API calls from the terminal.

