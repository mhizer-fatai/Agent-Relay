# 04 - Core Memory Concepts

AgentRelay partitions the agent's memory file into four distinct modules within the JSON memory file schema. This matches standard human memory structures and keeps data search efficient.

### 1. Logs (The Timeline List)
Logs register chronological execution traces and event outcomes. Each event entry logs:
* **Event ID:** Unique identifier for tracing.
* **Objective:** The target operation intent.
* **Actions Taken:** List of tool invocations or API prompts.
* **Outcome:** Result details and error flags.
* **Importance Score:** Priority weighting to determine retention and purge thresholds.

### 2. Facts (The Knowledge Repository)
Facts act as the agent's long-term database of facts, assertions, and rules. Facts are structured as RDF triples (Subject-Predicate-Object) alongside confidence scores and validation timestamps. This allows agents to query known facts without repeating search loops.

### 3. Tools (The Skills List)
Tools register execution recipes and tool skills. When an agent discovers a sequence to resolve a task (e.g. recovering from a node disconnect), it saves that skill recipe. Future runs can load and run the tool directly.

### 4. Relational Knowledge Graph
The Graph module maps relations between entities, concepts, and skills, helping agents contextualize information and trace dependencies during reasoning.

