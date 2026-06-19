try:
    from agentrelay.crewai import AgentRelayMemoryTool
except ImportError:
    from .main import AgentRelayMemoryTool
