import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load environment configurations
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Warning: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment. Database connection will fail.");
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');
const LOCAL_DB_FILE = path.resolve('db.json');

// Reads fallback database from local JSON file
function readLocalDb() {
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    return { profiles: [], agents: [], marketplace_listings: [], purchases: [], api_keys: [], cli_sessions: [], activity_log: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));

    // Migrate legacy users schema to profiles
    if (data.users && !data.profiles) {
      data.profiles = data.users.map(u => ({
        id: u.id || Math.random().toString(36).substring(2),
        email: u.email,
        username: u.username,
        api_key: u.api_key,
        wallet_address: u.zk_address,
        login_type: u.email ? 'google' : 'wallet',
        created_at: u.created_at || new Date().toISOString()
      }));
      delete data.users;
    }

    return {
      profiles: data.profiles || [],
      agents: data.agents || [],
      marketplace_listings: data.marketplace_listings || [],
      purchases: data.purchases || [],
      api_keys: data.api_keys || [],
      cli_sessions: data.cli_sessions || [],
      activity_log: data.activity_log || []
    };
  } catch (e) {
    return { profiles: [], agents: [], marketplace_listings: [], purchases: [], api_keys: [], cli_sessions: [], activity_log: [] };
  }
}

// Writes fallback database to local JSON file
function writeLocalDb(data) {
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export class Database {
  // Registers user profile with login type constraints and hashes API key securely
  async registerUser(email, apiKey, walletAddress = null, username = null, loginType = 'wallet') {
    try {
      let query = supabase.from('profiles').select('*');
      if (loginType === 'wallet' && walletAddress) {
        query = query.eq('wallet_address', walletAddress);
      } else if (email) {
        query = query.eq('email', email);
      } else {
        throw new Error("Invalid registration parameters: email or walletAddress required.");
      }

      const { data: existingUser } = await query.maybeSingle();

      if (!existingUser) {
        const randomHex = crypto.randomBytes(8).toString('hex');
        const generatedPlainKey = `ar_live_${randomHex}`;
        const hashedApiKey = crypto.createHash('sha256').update(generatedPlainKey).digest('hex');

        const { data, error } = await supabase
          .from('profiles')
          .insert([{
            email,
            api_key: hashedApiKey,
            wallet_address: walletAddress,
            username,
            login_type: loginType
          }])
          .select()
          .single();

        if (error) throw error;
        await this.logActivity(data.id, 'register_profile', null, { email, loginType });
        return {
          ...data,
          api_key: generatedPlainKey,
          is_new_registration: true
        };
      } else {
        await this.logActivity(existingUser.id, 'login_profile', null, { email, loginType });
        return existingUser;
      }
    } catch (err) {
      console.warn("Supabase error in registerUser, falling back to local database:", err.message || err);
      const db = readLocalDb();
      let user = null;
      if (loginType === 'wallet' && walletAddress) {
        user = db.profiles.find(u => u.wallet_address === walletAddress);
      } else if (email) {
        user = db.profiles.find(u => u.email === email);
      }

      if (!user) {
        const randomHex = crypto.randomBytes(8).toString('hex');
        const generatedPlainKey = `ar_live_${randomHex}`;
        const hashedApiKey = crypto.createHash('sha256').update(generatedPlainKey).digest('hex');

        user = {
          id: Math.random().toString(36).substring(2),
          email,
          api_key: hashedApiKey,
          wallet_address: walletAddress,
          username,
          login_type: loginType,
          created_at: new Date().toISOString()
        };
        db.profiles.push(user);
        writeLocalDb(db);
        return {
          ...user,
          api_key: generatedPlainKey,
          is_new_registration: true
        };
      } else {
        writeLocalDb(db);
        return user;
      }
    }
  }

  // Resolves profile by hashing client API key and looking it up
  async findUserByApiKey(apiKey) {
    if (!apiKey) return null;
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('api_key', hashedKey)
        .maybeSingle();

      if (error) throw error;

      // Fallback: search for unhashed legacy key
      if (!data) {
        const { data: legacyData } = await supabase
          .from('profiles')
          .select('*')
          .eq('api_key', apiKey)
          .maybeSingle();
        return legacyData || null;
      }

      return data;
    } catch (err) {
      console.warn("Supabase error in findUserByApiKey, falling back to local database:", err.message || err);
      const db = readLocalDb();
      let found = db.profiles.find(u => u.api_key === hashedKey);
      if (!found) {
        found = db.profiles.find(u => u.api_key === apiKey);
      }
      return found || null;
    }
  }

  // Rotates developer API key securely using SHA-256
  async rotateUserApiKey(emailOrAddress) {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const generatedPlainKey = `ar_live_${randomHex}`;
    const hashedApiKey = crypto.createHash('sha256').update(generatedPlainKey).digest('hex');

    try {
      const profile = await this.findProfileByEmailOrAddress(emailOrAddress);
      if (!profile) {
        throw new Error(`Profile not found for key rotation: ${emailOrAddress}`);
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ api_key: hashedApiKey })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      await this.logActivity(profile.id, 'rotate_api_key', null, {});
      return {
        profile: data,
        apiKey: generatedPlainKey
      };
    } catch (err) {
      console.warn("Supabase error in rotateUserApiKey, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const profile = db.profiles.find(u => u.email === emailOrAddress || u.wallet_address === emailOrAddress);
      if (!profile) {
        throw new Error(`Profile not found for key rotation: ${emailOrAddress}`);
      }

      profile.api_key = hashedApiKey;
      writeLocalDb(db);
      return {
        profile,
        apiKey: generatedPlainKey
      };
    }
  }

  // Resolves profile by email
  async findUserByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn("Supabase error in findUserByEmail, falling back to local database:", err.message || err);
      const db = readLocalDb();
      return db.profiles.find(u => u.email === email) || null;
    }
  }

  // Resolves profile by wallet address
  async findUserByWalletAddress(walletAddress) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn("Supabase error in findUserByWalletAddress, falling back to local database:", err.message || err);
      const db = readLocalDb();
      return db.profiles.find(u => u.wallet_address === walletAddress) || null;
    }
  }

  // Resolves profile by username
  async findUserByUsername(username) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn("Supabase error in findUserByUsername, falling back to local database:", err.message || err);
      const db = readLocalDb();
      return db.profiles.find(u => u.username === username) || null;
    }
  }

  // Helper to find profile by either email or wallet address
  async findProfileByEmailOrAddress(emailOrAddress) {
    if (!emailOrAddress) return null;
    if (emailOrAddress.startsWith('@')) {
      return await this.findUserByUsername(emailOrAddress.slice(1));
    }
    if (emailOrAddress.includes('@')) {
      return await this.findUserByEmail(emailOrAddress);
    }
    if (emailOrAddress.startsWith('0x') || emailOrAddress.length > 30) {
      return await this.findUserByWalletAddress(emailOrAddress);
    }
    return await this.findUserByEmail(emailOrAddress);
  }

  // Updates developer username profile
  async updateUsername(emailOrAddress, username) {
    try {
      const profile = await this.findProfileByEmailOrAddress(emailOrAddress);
      if (!profile) {
        throw new Error(`Profile not found for: ${emailOrAddress}`);
      }

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (existingUser && existingUser.id !== profile.id) {
        throw new Error(`Username "${username}" is already taken.`);
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      await this.logActivity(profile.id, 'claim_username', null, { username });
      return data;
    } catch (err) {
      console.warn("Supabase error in updateUsername, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const profile = db.profiles.find(u => u.email === emailOrAddress || u.wallet_address === emailOrAddress);
      if (!profile) {
        throw new Error(`Profile not found for: ${emailOrAddress}`);
      }

      const userWithUsername = db.profiles.find(u => u.username === username);
      if (userWithUsername && userWithUsername.id !== profile.id) {
        throw new Error(`Username "${username}" is already taken.`);
      }

      profile.username = username;
      writeLocalDb(db);
      return profile;
    }
  }

  // Retrieves all registered developer profiles
  async getAllUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn("Supabase error in getAllUsers, falling back to local database:", err.message || err);
      const db = readLocalDb();
      return db.profiles;
    }
  }

  // Register the agent name and details
  async registerAgent(ownerEmailOrAddress, name, currentBlobId, parentBlobId = null, suiObjectId = null, metadata = {}) {
    try {
      const profile = await this.findProfileByEmailOrAddress(ownerEmailOrAddress);
      if (!profile) {
        throw new Error(`Owner profile not found for: ${ownerEmailOrAddress}`);
      }

      let baseName = name;
      if (name.includes('/')) {
        baseName = name.split('/')[1];
      }

      const { data: existingAgent } = await supabase
        .from('agents')
        .select('*')
        .eq('alias', baseName)
        .eq('owner_id', profile.id)
        .maybeSingle();

      if (!existingAgent) {
        const { data, error } = await supabase
          .from('agents')
          .insert([{
            alias: baseName,
            owner_id: profile.id,
            current_blob_id: currentBlobId,
            parent_blob_id: parentBlobId,
            sui_object_id: suiObjectId,
            history: [currentBlobId],
            importance_score: metadata.importanceScore || 5,
            version: metadata.version || "1.0.0",
            source_links: metadata.sourceLinks || [],
            visibility: metadata.visibility || 'pr'
          }])
          .select()
          .single();

        if (error) throw error;
        await this.logActivity(profile.id, 'register_agent', baseName, { blobId: currentBlobId });
        if (data) {
          data.name = data.alias;
        }
        return data;
      } else {
        const updatedHistory = existingAgent.history.includes(currentBlobId)
          ? existingAgent.history
          : [...existingAgent.history, currentBlobId];

        const { data, error } = await supabase
          .from('agents')
          .update({
            current_blob_id: currentBlobId,
            sui_object_id: suiObjectId || existingAgent.sui_object_id,
            history: updatedHistory,
            importance_score: metadata.importanceScore || existingAgent.importance_score || 5,
            version: metadata.version || existingAgent.version || "1.0.0",
            source_links: metadata.sourceLinks || existingAgent.source_links || [],
            visibility: metadata.visibility || existingAgent.visibility || 'pr'
          })
          .eq('alias', baseName)
          .eq('owner_id', profile.id)
          .select()
          .single();

        if (error) throw error;
        await this.logActivity(profile.id, 'sync_agent', baseName, { blobId: currentBlobId });
        if (data) {
          data.name = data.alias;
        }
        return data;
      }
    } catch (err) {
      console.warn("Supabase error in registerAgent, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const profile = db.profiles.find(u => u.email === ownerEmailOrAddress || u.wallet_address === ownerEmailOrAddress);
      if (!profile) {
        throw new Error(`Owner profile not found for: ${ownerEmailOrAddress}`);
      }

      let baseName = name;
      if (name.includes('/')) {
        baseName = name.split('/')[1];
      }

      let agent = db.agents.find(a => a.name === baseName && a.owner_id === profile.id);
      if (!agent) {
        agent = {
          id: Math.random().toString(36).substring(2),
          name: baseName,
          owner_id: profile.id,
          current_blob_id: currentBlobId,
          parent_blob_id: parentBlobId,
          sui_object_id: suiObjectId,
          history: [currentBlobId],
          created_at: new Date().toISOString(),
          importance_score: metadata.importanceScore || 5,
          version: metadata.version || "1.0.0",
          source_links: metadata.sourceLinks || [],
          visibility: metadata.visibility || 'pr'
        };
        db.agents.push(agent);
      } else {
        agent.current_blob_id = currentBlobId;
        if (suiObjectId) agent.sui_object_id = suiObjectId;
        if (!agent.history.includes(currentBlobId)) {
          agent.history.push(currentBlobId);
        }
        agent.importance_score = metadata.importanceScore !== undefined ? metadata.importanceScore : (agent.importance_score || 5);
        agent.version = metadata.version || agent.version || "1.0.0";
        agent.source_links = metadata.sourceLinks || agent.source_links || [];
        agent.visibility = metadata.visibility || agent.visibility || 'pr';
      }
      writeLocalDb(db);
      return agent;
    }
  }

  // Find agent details by name, namespaced name, or Agent ID (UUID)
  async resolveAgent(name) {
    try {
      let query = supabase
        .from('agents')
        .select('*, profiles(username, email, wallet_address)');

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);

      if (isUuid) {
        query = query.eq('id', name);
      } else if (name.includes('/')) {
        const [username, agentName] = name.split('/');
        const profile = await this.findUserByUsername(username);
        if (!profile) return null;
        query = query.eq('alias', agentName).eq('owner_id', profile.id);
      } else {
        query = query.eq('alias', name);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        name: data.alias,
        owner_username: data.profiles?.username || null,
        owner_email: data.profiles?.email || null,
        owner_wallet_address: data.profiles?.wallet_address || null
      };
    } catch (err) {
      console.warn("Supabase error in resolveAgent, falling back to local database:", err.message || err);
      const db = readLocalDb();
      let agent;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);

      if (isUuid) {
        agent = db.agents.find(a => a.id === name);
      } else if (name.includes('/')) {
        const [username, agentName] = name.split('/');
        const profile = db.profiles.find(u => u.username === username);
        if (profile) {
          agent = db.agents.find(a => a.name === agentName && a.owner_id === profile.id);
        }
      } else {
        agent = db.agents.find(a => a.name === name);
      }

      // Check by unique local id if no agent matches by alias/name
      if (!agent) {
        agent = db.agents.find(a => a.id === name);
      }

      if (!agent) return null;

      const profile = db.profiles.find(u => u.id === agent.owner_id);
      return {
        ...agent,
        owner_username: profile?.username || null,
        owner_email: profile?.email || null,
        owner_wallet_address: profile?.wallet_address || null
      };
    }
  }

  // Find agent details by active state Blob ID
  async resolveAgentByBlobId(blobId) {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*, profiles(username, email, wallet_address)')
        .eq('current_blob_id', blobId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        name: data.alias,
        owner_username: data.profiles?.username || null,
        owner_email: data.profiles?.email || null,
        owner_wallet_address: data.profiles?.wallet_address || null
      };
    } catch (err) {
      console.warn("Supabase error in resolveAgentByBlobId, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const agent = db.agents.find(a => a.current_blob_id === blobId || (a.history && a.history.includes(blobId)));
      if (!agent) return null;

      const profile = db.profiles.find(u => u.id === agent.owner_id);
      return {
        ...agent,
        owner_username: profile?.username || null,
        owner_email: profile?.email || null,
        owner_wallet_address: profile?.wallet_address || null
      };
    }
  }

  // Lists all agents, optionally filtered by owner address/email
  async listAgents(ownerEmailOrAddress = null) {
    try {
      let query = supabase.from('agents').select('*, profiles(username, email, wallet_address)');
      if (ownerEmailOrAddress) {
        const profile = await this.findProfileByEmailOrAddress(ownerEmailOrAddress);
        if (profile) {
          query = query.eq('owner_id', profile.id);
        } else {
          return [];
        }
      }
      const { data, error } = await query;
      if (error) throw error;

      return data.map(agent => ({
        ...agent,
        name: agent.alias,
        owner_username: agent.profiles?.username || null,
        owner_email: agent.profiles?.email || null,
        owner_wallet_address: agent.profiles?.wallet_address || null
      }));
    } catch (err) {
      console.warn("Supabase error in listAgents, falling back to local database:", err.message || err);
      const db = readLocalDb();
      let agentsList = db.agents;

      if (ownerEmailOrAddress) {
        const profile = db.profiles.find(u => u.email === ownerEmailOrAddress || u.wallet_address === ownerEmailOrAddress);
        if (profile) {
          agentsList = db.agents.filter(a => a.owner_id === profile.id);
        } else {
          return [];
        }
      }

      return agentsList.map(agent => {
        const profile = db.profiles.find(u => u.id === agent.owner_id);
        return {
          ...agent,
          owner_username: profile?.username || null,
          owner_email: profile?.email || null,
          owner_wallet_address: profile?.wallet_address || null
        };
      });
    }
  }

  // Tracks pending CLI authorization requests
  async createCliSession(cliToken) {
    try {
      const { data, error } = await supabase
        .from('cli_sessions')
        .insert([{ cli_token: cliToken, status: 'pending' }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn("Supabase error in createCliSession, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const session = { cli_token: cliToken, status: 'pending', owner_id: null, api_key: null, created_at: new Date().toISOString() };
      db.cli_sessions.push(session);
      writeLocalDb(db);
      return session;
    }
  }

  // Authorizes a pending CLI session
  async authorizeCliSession(cliToken, apiKey, emailOrAddress) {
    try {
      const profile = await this.findProfileByEmailOrAddress(emailOrAddress);
      if (!profile) {
        throw new Error(`Profile not found for auth: ${emailOrAddress}`);
      }

      const { data, error } = await supabase
        .from('cli_sessions')
        .update({ status: 'authorized', api_key: apiKey, owner_id: profile.id })
        .eq('cli_token', cliToken)
        .select();

      if (error) throw error;
      await this.logActivity(profile.id, 'authorize_cli', null, { cliToken });
      return data && data.length > 0;
    } catch (err) {
      console.warn("Supabase error in authorizeCliSession, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const profile = db.profiles.find(u => u.email === emailOrAddress || u.wallet_address === emailOrAddress);
      if (!profile) return false;

      const session = db.cli_sessions.find(s => s.cli_token === cliToken);
      if (session) {
        session.status = 'authorized';
        session.api_key = apiKey;
        session.owner_id = profile.id;
        writeLocalDb(db);
        return true;
      }
      return false;
    }
  }

  // Polls CLI session status
  async pollCliSession(cliToken) {
    try {
      const { data, error } = await supabase
        .from('cli_sessions')
        .select('*, profiles(email, wallet_address, username)')
        .eq('cli_token', cliToken)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const ageMs = Date.now() - new Date(data.created_at).getTime();
      if (ageMs > 300000) {
        await supabase.from('cli_sessions').delete().eq('cli_token', cliToken);
        return null;
      }
      if (data.status === 'authorized') {
        await supabase.from('cli_sessions').delete().eq('cli_token', cliToken);
      }
      return {
        ...data,
        email: data.profiles?.username ? `@${data.profiles.username}` : (data.profiles?.email || data.profiles?.wallet_address)
      };
    } catch (err) {
      console.warn("Supabase error in pollCliSession, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const index = db.cli_sessions.findIndex(s => s.cli_token === cliToken);
      if (index === -1) return null;
      
      const session = db.cli_sessions[index];
      const ageMs = Date.now() - new Date(session.created_at).getTime();
      if (ageMs > 300000) {
        db.cli_sessions.splice(index, 1);
        writeLocalDb(db);
        return null;
      }
      const profile = db.profiles.find(p => p.id === session.owner_id);
      const result = {
        ...session,
        email: profile?.username ? `@${profile.username}` : (profile?.email || profile?.wallet_address)
      };
      if (session.status === 'authorized') {
        db.cli_sessions.splice(index, 1);
        writeLocalDb(db);
      }
      return result;
    }
  }

  // Creates a memory listing in the marketplace catalog
  async createMarketplaceListing(listingId, creatorEmailOrAddress, title, encryptedBlobId, priceMist, suiListingId = null) {
    try {
      const profile = await this.findProfileByEmailOrAddress(creatorEmailOrAddress);
      if (!profile) {
        throw new Error(`Creator profile not found for: ${creatorEmailOrAddress}`);
      }

      const { data, error } = await supabase
        .from('marketplace_listings')
        .insert([{
          id: listingId,
          creator_id: profile.id,
          title,
          encrypted_blob_id: encryptedBlobId,
          price_mist: BigInt(priceMist),
          sui_listing_id: suiListingId,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      await this.logActivity(profile.id, 'create_listing', null, { listingId, title });
      return data;
    } catch (err) {
      console.warn("Supabase error in createMarketplaceListing, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const profile = db.profiles.find(u => u.email === creatorEmailOrAddress || u.wallet_address === creatorEmailOrAddress);
      if (!profile) {
        throw new Error(`Creator profile not found for: ${creatorEmailOrAddress}`);
      }

      const listing = {
        id: listingId,
        creator_id: profile.id,
        title,
        encrypted_blob_id: encryptedBlobId,
        price_mist: priceMist.toString(),
        sui_listing_id: suiListingId,
        is_active: true,
        created_at: new Date().toISOString()
      };

      db.marketplace_listings.push(listing);
      writeLocalDb(db);
      return listing;
    }
  }

  // Retrieves active marketplace listings joined with creator details
  async getMarketplaceListings() {
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*, profiles(username, email, wallet_address)')
        .eq('is_active', true);

      if (error) throw error;

      return data.map(list => ({
        id: list.id,
        creator: list.profiles?.username || list.profiles?.wallet_address || list.profiles?.email || 'unknown',
        creator_id: list.creator_id,
        title: list.title,
        encryptedBlobId: list.encrypted_blob_id,
        price: Number(list.price_mist) / 1_000_000_000,
        sui_listing_id: list.sui_listing_id
      }));
    } catch (err) {
      console.warn("Supabase error in getMarketplaceListings, falling back to local database:", err.message || err);
      const db = readLocalDb();
      return db.marketplace_listings
        .filter(l => l.is_active)
        .map(list => {
          const profile = db.profiles.find(p => p.id === list.creator_id);
          return {
            id: list.id,
            creator: profile?.username || profile?.wallet_address || profile?.email || 'unknown',
            creator_id: list.creator_id,
            title: list.title,
            encryptedBlobId: list.encrypted_blob_id,
            price: Number(list.price_mist) / 1_000_000_000,
            sui_listing_id: list.sui_listing_id
          };
        });
    }
  }

  // Logs a purchase transaction and saves the resulting decryption key
  async recordPurchase(buyerEmailOrAddress, listingId, decryptionKey, suiTxDigest = null) {
    try {
      const profile = await this.findProfileByEmailOrAddress(buyerEmailOrAddress);
      if (!profile) {
        throw new Error(`Buyer profile not found for: ${buyerEmailOrAddress}`);
      }

      const { data, error } = await supabase
        .from('purchases')
        .insert([{
          buyer_id: profile.id,
          listing_id: listingId,
          decryption_key: decryptionKey,
          sui_tx_digest: suiTxDigest
        }])
        .select()
        .single();

      if (error) throw error;
      await this.logActivity(profile.id, 'purchase_pack', null, { listingId, suiTxDigest });
      return data;
    } catch (err) {
      console.warn("Supabase error in recordPurchase, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const profile = db.profiles.find(u => u.email === buyerEmailOrAddress || u.wallet_address === buyerEmailOrAddress);
      if (!profile) {
        throw new Error(`Buyer profile not found for: ${buyerEmailOrAddress}`);
      }

      const purchase = {
        id: Math.random().toString(36).substring(2),
        buyer_id: profile.id,
        listing_id: listingId,
        decryption_key: decryptionKey,
        sui_tx_digest: suiTxDigest,
        purchased_at: new Date().toISOString()
      };

      db.purchases.push(purchase);
      writeLocalDb(db);
      return purchase;
    }
  }

  // Retrieves purchased decryption keys for a buyer
  async getPurchasedKeys(buyerEmailOrAddress) {
    try {
      const profile = await this.findProfileByEmailOrAddress(buyerEmailOrAddress);
      if (!profile) return {};

      const { data, error } = await supabase
        .from('purchases')
        .select('listing_id, decryption_key')
        .eq('buyer_id', profile.id);

      if (error) throw error;

      const keys = {};
      data.forEach(p => {
        keys[p.listing_id] = p.decryption_key;
      });
      return keys;
    } catch (err) {
      console.warn("Supabase error in getPurchasedKeys, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const profile = db.profiles.find(u => u.email === buyerEmailOrAddress || u.wallet_address === buyerEmailOrAddress);
      if (!profile) return {};

      const keys = {};
      db.purchases
        .filter(p => p.buyer_id === profile.id)
        .forEach(p => {
          keys[p.listing_id] = p.decryption_key;
        });
      return keys;
    }
  }

  // Log a developer action record
  async logActivity(ownerId, action, targetName = null, metadata = {}) {
    try {
      await supabase
        .from('activity_log')
        .insert([{
          owner_id: ownerId,
          action,
          target_name: targetName,
          metadata
        }]);
    } catch (err) {
      console.warn("Supabase error in logActivity, falling back to local database:", err.message || err);
      const db = readLocalDb();
      const log = {
        id: Math.random().toString(36).substring(2),
        owner_id: ownerId,
        action,
        target_name: targetName,
        metadata,
        created_at: new Date().toISOString()
      };
      db.activity_log.push(log);
      writeLocalDb(db);
    }
  }
}

