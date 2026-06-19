import os
import json
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type, Dict, Any

class AgentRelayMemoryInput(BaseModel):
    name: str = Field(description="The unique name of the agent to query or update.")
    context: Dict[str, Any] = Field(default=None, description="The memory dictionary payload to save. Only used for commit actions.")
    action: str = Field(description="Action to perform: 'remember' to commit memory, or 'recall' to retrieve latest state.")
    blob_id: str = Field(default=None, description="Direct Walrus blob ID to bypass name resolution.")
    decryption_key: str = Field(default=None, description="Symmetric decryption key passphrase.")

class AgentRelayMemoryTool(BaseTool):
    name: str = "AgentRelay Memory Integration Tool"
    description: str = "Tool to persist and recall secure AI agent memory across runs using the AgentRelay API."
    args_schema: Type[BaseModel] = AgentRelayMemoryInput

    backend_url: str = os.getenv("AGENTRELAY_BACKEND_URL", "http://localhost:3000")
    api_key: str = os.getenv("AGENTRELAY_API_KEY", "")

    # Execute tool logic
    def _run(self, name: str, action: str, context: Dict[str, Any] = None, blob_id: str = None, decryption_key: str = None) -> str:
        from agentrelay.core.engine import AgentRelayMemoryEngine
        # Instantiate core engine to handle caching, locking, and synchronization
        engine = AgentRelayMemoryEngine(
            agent_name=name,
            api_key=self.api_key,
            backend_url=self.backend_url,
            blob_id=blob_id,
            decryption_key=decryption_key
        )

        # Handle remember action
        if action == "remember":
            if not context:
                return "Error: Memory context must be provided for remember action."
            
            try:
                engine.save_memory(context)
                return "Success: Memory committed."
            except Exception as e:
                return f"Error: Save operation failed: {str(e)}"

        # Handle recall action
        elif action == "recall":
            try:
                memory = engine.get_memory()
                if memory:
                    return json.dumps(memory, indent=2)
                return f"No active memory files found for agent: '{name}'."
            except Exception as e:
                return f"Error: Recall operation failed: {str(e)}"
        
        else:
            return f"Error: Invalid action '{action}'. Use 'remember' or 'recall'."
