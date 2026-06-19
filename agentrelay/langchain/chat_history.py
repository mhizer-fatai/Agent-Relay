import os
from typing import List, Optional
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, message_to_dict, messages_from_dict
from agentrelay.core.engine import AgentRelayMemoryEngine

class AgentRelayChatMessageHistory(BaseChatMessageHistory):
    """
    LangChain Chat Message History integration for AgentRelay.
    Delegates persistence, locking, caching, and async uploads to the core engine.
    """

    def __init__(
        self,
        agent_name: str,
        api_key: Optional[str] = None,
        visibility: str = "pr",
        backend_url: Optional[str] = None,
        connection_string: Optional[str] = None,
        sync_interval: int = 5,
        max_token_limit: Optional[int] = None,
        enable_locking: bool = True,
        async_backup: bool = True,
        blob_id: Optional[str] = None,
        decryption_key: Optional[str] = None
    ):
        self.engine = AgentRelayMemoryEngine(
            agent_name=agent_name,
            api_key=api_key,
            visibility=visibility,
            backend_url=backend_url,
            connection_string=connection_string,
            sync_interval=sync_interval,
            max_token_limit=max_token_limit,
            enable_locking=enable_locking,
            async_backup=async_backup,
            blob_id=blob_id,
            decryption_key=decryption_key
        )

    @property
    def messages(self) -> List[BaseMessage]:
        """Retrieves and deserializes active message history."""
        manifest = self.engine.get_memory()
        history_data = manifest.get("history", [])
        if history_data:
            return messages_from_dict(history_data)
        return []

    def add_message(self, message: BaseMessage) -> None:
        """Appends a new message to the memory history."""
        # Retrieve current manifest state
        manifest = self.engine.get_memory()
        history_data = manifest.get("history", [])
        
        # Serialize and append the message
        serialized_msg = message_to_dict(message)
        history_data.append(serialized_msg)
        
        manifest["history"] = history_data
        self.engine.save_memory(manifest)

    def clear(self) -> None:
        """Clears local state and updates backend."""
        self.engine.save_memory({"history": []})
