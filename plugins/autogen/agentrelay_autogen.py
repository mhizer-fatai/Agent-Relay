import os
import requests
from typing import Dict, Any, Callable, Optional

class AgentRelayAutoGenManager:
    """
    AutoGen Integration Manager for AgentRelay.
    Provides tools and auto-reply callbacks to sync agent memory to Walrus.
    """

    def __init__(
        self, 
        agent_name: str, 
        api_key: Optional[str] = None, 
        visibility: str = "pr", 
        backend_url: Optional[str] = None
    ):
        self.agent_name = agent_name
        self.api_key = api_key or os.getenv("AGENTRELAY_API_KEY")
        self.visibility = visibility
        self.backend_url = backend_url or os.getenv("AGENTRELAY_BACKEND_URL", "http://localhost:3000")

        if not self.api_key:
            raise ValueError(
                "AGENTRELAY_API_KEY is missing. "
                "Please configure the key in the constructor or environment variables."
            )

    def get_memory_tool(self) -> Callable:
        """Returns a registered callable function suitable for AutoGen agent tools."""
        def agentrelay_memory_tool(action: str, context: Optional[dict] = None) -> str:
            """
            Tool to save or recall agent memory on Walrus via AgentRelay.
            :param action: 'recall' to retrieve latest memory, or 'remember' to save state.
            :param context: Dict containing facts/logs to commit (required for 'remember').
            """
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            if action == "remember":
                if not context:
                    return "Error: Memory context payload must be provided for remember action."
                try:
                    payload = {
                        "name": self.agent_name,
                        "context": context,
                        "version": "1.0.0",
                        "visibility": self.visibility
                    }
                    res = requests.post(f"{self.backend_url}/api/agents/remember", json=payload, headers=headers)
                    if res.status_code == 200:
                        return f"Success: Memory committed. BlobID: {res.json().get('blobId')}"
                    return f"Error: Backend failed with status code {res.status_code}: {res.text}"
                except Exception as e:
                    return f"Error: Connection to backend failed: {str(e)}"

            elif action == "recall":
                try:
                    res = requests.get(f"{self.backend_url}/api/agents/recall/{self.agent_name}", headers=headers)
                    if res.status_code == 200:
                        return res.text
                    return f"No active memory files found for agent: '{self.agent_name}'."
                except Exception as e:
                    return f"Error: Connection to backend failed: {str(e)}"

            return "Error: Invalid action. Use 'remember' or 'recall'."

        return agentrelay_memory_tool

    def register_auto_sync(self, agent: Any) -> None:
        """Registers an auto-reply callback in AutoGen to record conversation turns automatically."""
        def sync_callback(recipient, messages, sender, config):
            if messages:
                last_msg = messages[-1]
                context_payload = {
                    "episodic": [{
                        "event": "autogen_turn",
                        "actions": [last_msg.get("content", "")],
                        "outcome": f"Processed message from {sender.name}",
                        "importance_score": 5
                    }]
                }
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                try:
                    payload = {
                        "name": self.agent_name,
                        "context": context_payload,
                        "version": "1.0.0",
                        "visibility": self.visibility
                    }
                    requests.post(f"{self.backend_url}/api/agents/remember", json=payload, headers=headers)
                except Exception as e:
                    print(f"Warning: AutoGen memory sync callback failed: {e}")
            
            return False, None

        agent.register_reply(
            trigger=[Any],
            reply_func=sync_callback,
            position=0
        )
