import os
from typing import Dict, Any, Callable, Optional
from agentrelay.core.engine import AgentRelayMemoryEngine

class AgentRelayAutoGenManager:
    """
    AutoGen Integration Manager for AgentRelay.
    Provides tools and auto-reply callbacks, delegating state caching to the core engine.
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

    def get_memory_tool(self) -> Callable:
        """Returns a registered callable function suitable for AutoGen agent tools."""
        def agentrelay_memory_tool(action: str, context: Optional[dict] = None) -> str:
            """
            Tool to save or recall agent memory on Walrus via AgentRelay.
            :param action: 'recall' to retrieve latest memory, or 'remember' to save state.
            :param context: Dict containing facts/logs to commit (required for 'remember').
            """
            if action == "remember":
                if not context:
                    return "Error: Memory context payload must be provided for remember action."
                try:
                    self.engine.save_memory(context)
                    return "Success: Memory saved to local cache/network backup."
                except Exception as e:
                    return f"Error: Save operation failed: {str(e)}"

            elif action == "recall":
                try:
                    memory = self.engine.get_memory()
                    if memory:
                        import json
                        return json.dumps(memory, indent=2)
                    return f"No active memory files found for agent: '{self.engine.agent_name}'."
                except Exception as e:
                    return f"Error: Recall operation failed: {str(e)}"

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
                try:
                    self.engine.save_memory(context_payload)
                except Exception as e:
                    print(f"Warning: AutoGen memory sync callback failed: {e}")
            
            return False, None

        agent.register_reply(
            trigger=[Any],
            reply_func=sync_callback,
            position=0
        )
