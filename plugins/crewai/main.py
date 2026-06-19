import os
import json
import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type, Dict, Any

class AgentRelayMemoryInput(BaseModel):
    name: str = Field(description="The unique name of the agent to query or update.")
    context: Dict[str, Any] = Field(default=None, description="The memory dictionary payload to save. Only used for commit actions.")
    action: str = Field(description="Action to perform: 'remember' to commit memory, or 'recall' to retrieve latest state.")

class AgentRelayMemoryTool(BaseTool):
    name: str = "AgentRelay Memory Integration Tool"
    description: str = "Tool to persist and recall secure AI agent memory across runs using the AgentRelay API."
    args_schema: Type[BaseModel] = AgentRelayMemoryInput

    backend_url: str = os.getenv("AGENTRELAY_BACKEND_URL", "http://localhost:3000")
    api_key: str = os.getenv("AGENTRELAY_API_KEY", "")

    # Execute tool logic
    def _run(self, name: str, action: str, context: Dict[str, Any] = None) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Handle remember action
        if action == "remember":
            if not context:
                return "Error: Memory context must be provided for remember action."
            
            try:
                payload = {
                    "name": name,
                    "context": context,
                    "version": "1.0.0",
                    "importance": 5
                }
                res = requests.post(f"{self.backend_url}/api/agents/remember", json=payload, headers=headers)
                if res.status_code == 200:
                    return f"Success: Memory committed. BlobID: {res.json().get('blobId')}"
                else:
                    return f"Error: API failed with status code {res.status_code}: {res.text}"
            except Exception as e:
                return f"Error: Connection to backend failed: {str(e)}"

        # Handle recall action
        elif action == "recall":
            try:
                res = requests.get(f"{self.backend_url}/api/agents/recall/{name}", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    manifest = data.get("manifest", {})
                    return json.dumps(manifest, indent=2)
                elif res.status_code == 404:
                    return f"No active memory files found for agent: '{name}'."
                else:
                    return f"Error: API failed with status code {res.status_code}: {res.text}"
            except Exception as e:
                return f"Error: Connection to backend failed: {str(e)}"
        
        else:
            return f"Error: Invalid action '{action}'. Use 'remember' or 'recall'."

