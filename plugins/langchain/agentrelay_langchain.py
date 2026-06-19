import os
import requests
from typing import List, Optional
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, message_to_dict, messages_from_dict

class AgentRelayChatMessageHistory(BaseChatMessageHistory):
    """
    LangChain Chat Message History integration for AgentRelay.
    Encrypts and persists conversation state to Walrus Testnet.
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
        self.messages_list: List[BaseMessage] = []

        if not self.api_key:
            raise ValueError(
                "AGENTRELAY_API_KEY is missing. "
                "Please pass api_key to the constructor or set the AGENTRELAY_API_KEY environment variable."
            )

        # Pre-load history from backend on initialization
        self.load_from_backend()

    @property
    def messages(self) -> List[BaseMessage]:
        return self.messages_list

    def add_message(self, message: BaseMessage) -> None:
        """Appends a new message to the timeline and pushes updates to Walrus."""
        self.messages_list.append(message)
        self.sync_to_backend()

    def clear(self) -> None:
        """Clears local state and updates backend."""
        self.messages_list = []
        self.sync_to_backend()

    def sync_to_backend(self) -> None:
        """Serializes messages list and commits snapshot via API remember route."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        serialized = [message_to_dict(msg) for msg in self.messages_list]

        try:
            payload = {
                "name": self.agent_name,
                "context": {
                    "history": serialized
                },
                "version": "1.0.0",
                "visibility": self.visibility
            }
            res = requests.post(
                f"{self.backend_url}/api/agents/remember",
                json=payload,
                headers=headers
            )
            if res.status_code != 200:
                print(f"Warning: AgentRelay remember sync failed: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"Error: Connection to AgentRelay backend failed during sync: {e}")

    def load_from_backend(self) -> None:
        """Recalls and reconstructs message objects from the stored history."""
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            res = requests.get(
                f"{self.backend_url}/api/agents/recall/{self.agent_name}",
                headers=headers
            )
            if res.status_code == 200:
                data = res.json()
                manifest = data.get("manifest", {})
                history_data = manifest.get("history", [])
                
                # Rebuild rich message objects from serialized JSON formats
                if history_data:
                    self.messages_list = messages_from_dict(history_data)
            elif res.status_code != 404:
                print(f"Warning: AgentRelay recall query failed: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"Error: Connection to AgentRelay backend failed during recall: {e}")
