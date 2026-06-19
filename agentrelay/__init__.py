import importlib
from .core.engine import AgentRelayMemoryEngine

__version__ = "1.1.0"

# Expose package properties dynamically to support lazy loading
def __getattr__(name: str):
    if name in ("langchain", "crewai", "autogen"):
        # Import and cache the submodule dynamically
        module = importlib.import_module(f".{name}", __name__)
        globals()[name] = module
        return module
    raise AttributeError(f"module {__name__} has no attribute {name}")

def __dir__():
    return ["__version__", "langchain", "crewai", "autogen", "AgentRelayMemoryEngine"]
