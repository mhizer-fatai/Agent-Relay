import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { Database } from './db.js';
import { AgentRelayClient } from '@agentrelay/sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database();
const CACHE_DIR = path.resolve('walrus_cache');

// Configure CORS and parser middlewares
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'supabase' });
});

// Registers user or maps API Key when logging in on dashboard
app.post('/api/auth/register-or-login', async (req, res) => {
  const { email, apiKey, zkAddress, walletAddress, loginType } = req.body;
  const resolvedAddress = walletAddress || zkAddress || null;
  const resolvedLoginType = loginType || (resolvedAddress ? 'wallet' : 'google');
  if (!email && !resolvedAddress) {
    return res.status(400).json({ error: 'Missing required parameters: email or walletAddress' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing required parameter: apiKey' });
  }
  try {
    const result = await db.registerUser(email, apiKey, resolvedAddress, null, resolvedLoginType);
    if (result.is_new_registration) {
      res.json({ success: true, user: { ...result, api_key: undefined, is_new_registration: undefined }, apiKey: result.api_key });
    } else {
      res.json({ success: true, user: { ...result, api_key: undefined } });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetches user profile details by email or address (sanitizes the hashed key)
app.get('/api/auth/user/:emailOrAddress', async (req, res) => {
  const { emailOrAddress } = req.params;
  try {
    const user = await db.findProfileByEmailOrAddress(emailOrAddress);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user: { ...user, api_key: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retrieves all registered user profiles with sanitized keys
app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    const sanitized = users.map(u => ({ ...u, api_key: undefined }));
    res.json({ success: true, users: sanitized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Sets unique username for developer onboarding
app.post('/api/auth/username', async (req, res) => {
  const { email, walletAddress, username } = req.body;
  const emailOrAddress = email || walletAddress;
  if (!emailOrAddress || !username) {
    return res.status(400).json({ error: 'Missing required parameters: email or walletAddress, username' });
  }
  const usernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username must be alphanumeric (3-16 characters) and can include underscores.' });
  }
  try {
    const user = await db.updateUsername(emailOrAddress, username);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generates and tracks a pending CLI token login connection
app.post('/api/auth/cli-token', async (req, res) => {
  const { cliToken } = req.body;
  if (!cliToken) {
    return res.status(400).json({ error: 'Missing parameter: cliToken' });
  }
  try {
    const session = await db.createCliSession(cliToken);
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard authorises a pending CLI session
app.post('/api/auth/cli-authorize', async (req, res) => {
  const { cliToken, apiKey, email } = req.body;
  if (!cliToken || !apiKey || !email) {
    return res.status(400).json({ error: 'Missing parameters: cliToken, apiKey, email' });
  }
  try {
    const success = await db.authorizeCliSession(cliToken, apiKey, email);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Polls the state of a CLI token login connection session
app.get('/api/auth/cli-poll/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const session = await db.pollCliSession(token);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verifies a developer CLI's API Key (checks hash)
app.get('/api/auth/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const apiKey = authHeader.split(' ')[1];
  try {
    const user = await db.findUserByApiKey(apiKey);
    if (!user) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }
    res.json({ success: true, user: { ...user, api_key: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rotates the developer API Key and returns the new plaintext key once
app.post('/api/auth/rotate-key', async (req, res) => {
  const { emailOrAddress } = req.body;
  if (!emailOrAddress) {
    return res.status(400).json({ error: 'Missing parameter: emailOrAddress' });
  }
  try {
    const result = await db.rotateUserApiKey(emailOrAddress);
    res.json({ success: true, user: { ...result.profile, api_key: undefined }, apiKey: result.apiKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find agent details by name
app.get('/api/agents/resolve/:name(*)', async (req, res) => {
  const { name } = req.params;
  try {
    const agent = await db.resolveAgent(name);
    if (!agent) {
      return res.status(404).json({ error: `Agent name "${name}" not found` });
    }
    res.json({ success: true, agent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolves agent details by active state Blob ID
app.get('/api/agents/resolve-blob/:blobId', async (req, res) => {
  const { blobId } = req.params;
  try {
    const agent = await db.resolveAgentByBlobId(blobId);
    if (!agent) {
      return res.status(404).json({ error: `Agent state with Blob ID "${blobId}" not found` });
    }
    res.json({ success: true, agent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save or update agent details and memory history
app.post('/api/agents/sync', async (req, res) => {
  const { name, ownerEmail, currentBlobId, parentBlobId, suiObjectId, importanceScore, version, sourceLinks, visibility } = req.body;
  if (!name || !ownerEmail || !currentBlobId) {
    return res.status(400).json({ error: 'Missing parameters: name, ownerEmail, currentBlobId' });
  }

  // Verify fork permissions if branching from a parent memory
  if (parentBlobId) {
    try {
      const parentAgent = await db.resolveAgentByBlobId(parentBlobId);
      if (parentAgent) {
        const isOwner = parentAgent.owner_email === ownerEmail || parentAgent.owner_wallet_address === ownerEmail || parentAgent.owner_username === ownerEmail;
        if (parentAgent.visibility !== 'pb' && !isOwner) {
          return res.status(403).json({ error: "Cannot fork another developer's private memory. Only public memories or your own agents' memories can be forked." });
        }
      }
    } catch (e) {
      console.warn("Failed to verify parent agent fork permissions:", e);
    }
  }

  try {
    const agent = await db.registerAgent(ownerEmail, name, currentBlobId, parentBlobId, suiObjectId, {
      importanceScore,
      version,
      sourceLinks,
      visibility
    });
    res.json({ success: true, agent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lists all agents owned by the developer
app.get('/api/agents/list', async (req, res) => {
  const emailOrAddress = req.query.email || req.query.walletAddress;
  try {
    const agents = await db.listAgents(emailOrAddress);
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Uploads encrypted agent state memory to Walrus Testnet publisher with offline cache fallback
app.post('/api/walrus/upload', async (req, res) => {
  const { content } = req.body;
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.put(
      'https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=1',
      contentStr,
      {
        headers: { 'Content-Type': 'application/octet-stream' },
        httpsAgent: agent,
        timeout: 10000
      }
    );

    const data = response.data;
    let blobId = '';
    if (data.newlyCreated) {
      blobId = data.newlyCreated.blobObject.blobId;
    } else if (data.alreadyCertified) {
      blobId = data.alreadyCertified.blobObject.blobId;
    }

    // Cache locally for faster retrieval
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(path.join(CACHE_DIR, blobId), contentStr, 'utf-8');
    } catch (fsErr) {}

    res.json({
      success: true,
      blobId,
      bytesStored: contentStr.length,
      storageNode: 'publisher.walrus-testnet.walrus.space'
    });
  } catch (error) {
    console.warn('Walrus publisher offline or timed out, falling back to simulated storage:', error.message);
    const mockHash = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const fallbackBlobId = `walrus-fallback-${mockHash}`;
    
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(path.join(CACHE_DIR, fallbackBlobId), contentStr, 'utf-8');
    } catch (fsErr) {}

    res.json({
      success: true,
      blobId: fallbackBlobId,
      bytesStored: contentStr.length,
      storageNode: 'fallback.local-simulated-node'
    });
  }
});

// Proxies or downloads a blob from aggregator with local cache resolver
app.get('/api/walrus/download/:blobId', async (req, res) => {
  const { blobId } = req.params;
  const localPath = path.join(CACHE_DIR, blobId);

  // Check local cache first
  if (fs.existsSync(localPath)) {
    try {
      const content = fs.readFileSync(localPath, 'utf-8');
      return res.send(content);
    } catch (e) {}
  }

  // Fallback to query aggregator directly
  try {
    const response = await axios.get(
      `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`,
      { responseType: 'text', timeout: 10000 }
    );
    const data = response.data;

    // Cache downloaded content locally
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(localPath, data, 'utf-8');
    } catch (fsErr) {}

    res.send(data);
  } catch (error) {
    console.error('Walrus aggregator fetch failed:', error.message);
    res.status(500).json({ error: `Walrus storage fetch failed: ${error.message}` });
  }
});

// Verifies the developer API key
async function verifyApiKey(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const apiKey = authHeader.split(' ')[1];
  const user = await db.findUserByApiKey(apiKey);
  return user || null;
}

// Save memory data and upload to network
app.post('/api/agents/remember', async (req, res) => {
  const user = await verifyApiKey(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }

  const { name, context, version, importance, visibility } = req.body;
  if (!name || !context) {
    return res.status(400).json({ error: 'Missing required parameters: name, context' });
  }

  try {
    let parentBlobId = null;
    try {
      const parentAgent = await db.resolveAgent(name);
      if (parentAgent && parentAgent.current_blob_id) {
        parentBlobId = parentAgent.current_blob_id;
      }
    } catch (e) {}

    const sourceLinks = parentBlobId ? [parentBlobId] : [];

    const sdkClient = new AgentRelayClient({
      simulateMode: false,
      walrusServerUrl: `http://localhost:${PORT}`
    });

    const blobId = await sdkClient.remember(name, context, {
      version: version || '1.0.0',
      importance: importance !== undefined ? Number(importance) : undefined,
      sourceLinks,
      visibility
    });

    const agent = await db.registerAgent(user.email || user.wallet_address, name, blobId, parentBlobId, null, {
      importanceScore: importance !== undefined ? Number(importance) : undefined,
      version: version || '1.0.0',
      sourceLinks,
      visibility
    });

    res.json({
      success: true,
      blobId,
      agent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download memory data and decrypt it
app.get('/api/agents/recall/:name(*)', async (req, res) => {
  const user = await verifyApiKey(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }

  const { name } = req.params;

  try {
    const agent = await db.resolveAgent(name);
    if (!agent || !agent.current_blob_id) {
      return res.status(404).json({ error: `No active memory state found for agent: ${name}` });
    }

    const sdkClient = new AgentRelayClient({
      simulateMode: false,
      walrusServerUrl: `http://localhost:${PORT}`
    });

    const manifest = await sdkClient.recall(agent.current_blob_id);

    res.json({
      success: true,
      name,
      blobId: agent.current_blob_id,
      manifest
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetches active marketplace listings
app.get('/api/marketplace/listings', async (req, res) => {
  try {
    const listings = await db.getMarketplaceListings();
    res.json({ success: true, listings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Creates a marketplace listing
app.post('/api/marketplace/listings', async (req, res) => {
  const { listingId, creator, title, encryptedBlobId, priceMist, suiListingId } = req.body;
  if (!listingId || !creator || !title || !encryptedBlobId || !priceMist) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  try {
    const listing = await db.createMarketplaceListing(listingId, creator, title, encryptedBlobId, priceMist, suiListingId);
    res.json({ success: true, listing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetches purchased key maps
app.get('/api/marketplace/purchases', async (req, res) => {
  const buyer = req.query.buyer;
  if (!buyer) {
    return res.status(400).json({ error: 'Missing parameter: buyer' });
  }
  try {
    const keys = await db.getPurchasedKeys(buyer);
    res.json({ success: true, purchasedKeys: keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Records a marketplace purchase
app.post('/api/marketplace/purchases', async (req, res) => {
  const { buyer, listingId, decryptionKey, suiTxDigest } = req.body;
  if (!buyer || !listingId || !decryptionKey) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  try {
    const purchase = await db.recordPurchase(buyer, listingId, decryptionKey, suiTxDigest);
    res.json({ success: true, purchase });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`AgentRelay Express backend listening at http://localhost:${PORT}`);
});
