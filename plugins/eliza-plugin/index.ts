import { AgentRelayClient } from "@agentrelay/sdk";

export class AgentRelayElizaAdapter {
  private baseAdapter: any;
  private client: AgentRelayClient;
  private agentId: string;
  private apiKey: string;

  constructor(baseAdapter: any, agentId: string, apiKey: string, backendUrl?: string) {
    this.baseAdapter = baseAdapter;
    this.agentId = agentId;
    this.apiKey = apiKey;
    this.client = new AgentRelayClient({
      simulateMode: false,
      walrusServerUrl: backendUrl || "http://localhost:3000"
    });
  }

  // Intercept memory creation to sync states
  async createMemory(memory: any, tableName: string, unique?: boolean): Promise<void> {
    await this.baseAdapter.createMemory(memory, tableName, unique);

    try {
      const activeMemories = await this.baseAdapter.getMemories({
        roomId: memory.roomId,
        count: 50
      });

      // Encrypt and commit current active memory state to Walrus
      await this.client.remember(this.agentId, {
        roomId: memory.roomId,
        tableName,
        recentContext: activeMemories,
        timestamp: new Date().toISOString()
      }, {
        version: "1.0.0",
        importance: 5
      });
    } catch (e: any) {
      console.warn("AgentRelay failed to sync memory file:", e.message || e);
    }
  }

  // Retrieve memories
  async getMemories(params: any): Promise<any[]> {
    return await this.baseAdapter.getMemories(params);
  }

  // Restore state from latest list snapshot on boot
  async restoreFromList(blobId: string): Promise<void> {
    try {
      const manifest = await this.client.recall(blobId);
      if (manifest && manifest.recentContext) {
        for (const memory of manifest.recentContext) {
          await this.baseAdapter.createMemory(memory, manifest.tableName || "messages", true);
        }
      }
    } catch (e: any) {
      console.error("AgentRelay failed to restore memory file:", e.message || e);
    }
  }
}
