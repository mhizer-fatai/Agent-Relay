import { AgentRelayClient } from "@agentrelay/sdk";

export class AgentRelayChatMessageHistory {
  private client: AgentRelayClient;
  private agentId: string;
  private messagesList: any[] = [];

  constructor(agentId: string, backendUrl?: string) {
    this.agentId = agentId;
    this.client = new AgentRelayClient({
      simulateMode: false,
      walrusServerUrl: backendUrl || "http://localhost:3000"
    });
  }

  // Returns list of messages in history
  async getMessages(): Promise<any[]> {
    return this.messagesList;
  }

  // Appends new message to history
  async addMessage(message: any): Promise<void> {
    this.messagesList.push(message);
    await this.syncToAgentRelay();
  }

  // Clear messages
  async clear(): Promise<void> {
    this.messagesList = [];
    await this.syncToAgentRelay();
  }

  // Sync state to AgentRelay list
  private async syncToAgentRelay(): Promise<void> {
    try {
      const serialized = this.messagesList.map(msg => ({
        type: msg.type || msg._getType?.() || "human",
        content: msg.content,
        timestamp: new Date().toISOString()
      }));

      // Commit memory vector state
      await this.client.remember(this.agentId, {
        history: serialized,
        timestamp: new Date().toISOString()
      }, {
        version: "1.0.0",
        importance: 5
      });
    } catch (e: any) {
      console.warn("AgentRelay failed to synchronize LangChain chat history:", e.message || e);
    }
  }

  // Load chat history from a previous memory file
  async restoreFromList(blobId: string): Promise<void> {
    try {
      const manifest = await this.client.recall(blobId);
      if (manifest && manifest.history) {
        // Reconstruct messages list from serialized format
        this.messagesList = manifest.history.map((msg: any) => {
          return {
            type: msg.type,
            content: msg.content
          };
        });
      }
    } catch (e: any) {
      console.error("AgentRelay failed to restore LangChain chat history:", e.message || e);
    }
  }
}
