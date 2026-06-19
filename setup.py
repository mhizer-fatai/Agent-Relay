from setuptools import setup, find_packages

setup(
    name="agentrelay-memory",
    version="1.1.0",
    description="AgentRelay Secure Memory Persistence and Recall integrations for AI frameworks.",
    author="AgentRelay Team",
    packages=find_packages(include=["agentrelay", "agentrelay.*"]),
    install_requires=[
        "requests>=2.25.0",
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
)
