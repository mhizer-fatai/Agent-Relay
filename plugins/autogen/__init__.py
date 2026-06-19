try:
    from agentrelay.autogen import AgentRelayAutoGenManager
except ImportError:
    from .agentrelay_autogen import AgentRelayAutoGenManager
