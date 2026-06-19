#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import open from 'open';
import { AgentRelayClient } from '@agentrelay/sdk';

const program = new Command();
const CONFIG_DIR = path.join(os.homedir(), '.agentrelay');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const BACKEND_URL = process.env.AGENTRELAY_BACKEND_URL || 'https://agent-relay-backend.onrender.com';
const DASHBOARD_URL = process.env.AGENTRELAY_DASHBOARD_URL || 'https://agent-relay.netlify.app';

// Ensures local user config directory and file exist
function getAuthCredentials() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Writes auth configurations locally to user home folder
function saveAuthCredentials(apiKey, email) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey, email }, null, 2), 'utf-8');
}

// Reads workspace file .agentrelay.json in current directory
function getWorkspaceConfig() {
  const localFile = path.join(process.cwd(), '.agentrelay.json');
  if (!fs.existsSync(localFile)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(localFile, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name || parsed.namespace,
      ...parsed
    };
  } catch (e) {
    return null;
  }
}

// Configures CLI metadata
program
  .name('ar')
  .description('Sovereign Intelligence Protocol CLI Tool')
  .version('1.0.0');

// Login command: registers session token and polls for browser authorization confirmation
program
  .command('login')
  .description('Log in to AgentRelay using your web dashboard profile')
  .action(async () => {
    console.log('Initiating dashboard authentication login connection...');
    const cliToken = `cli_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;

    try {
      await axios.post(`${BACKEND_URL}/api/auth/cli-token`, { cliToken });
      
      const authUrl = `${DASHBOARD_URL}/cli-login?token=${cliToken}`;
      console.log(`\nOpening browser window to authorize: ${authUrl}\n`);
      await open(authUrl);

      console.log('Waiting for authorization confirmation from browser dashboard...');
      
      const pollInterval = setInterval(async () => {
        try {
          const res = await axios.get(`${BACKEND_URL}/api/auth/cli-poll/${cliToken}`);
          const session = res.data.session;

          if (session && session.status === 'authorized') {
            clearInterval(pollInterval);
            saveAuthCredentials(session.api_key, session.email);
            console.log(`\nSuccess! Successfully authenticated as: ${session.email}`);
            process.exit(0);
          }
        } catch (err) {
          // Continue polling silently on network or pending errors
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        console.log('Error: Login request timed out. Please run the login command again.');
        process.exit(1);
      }, 180000);

    } catch (error) {
      console.error('Failed to connect to authentication server:', error.message);
      process.exit(1);
    }
  });

// Init command: configures name settings inside current workspace
program
  .command('init')
  .description('Initialize agent context in the current workspace directory')
  .requiredOption('--name <name>', 'Unique developer name for the agent workspace')
  .action((options) => {
    const localFile = path.join(process.cwd(), '.agentrelay.json');
    const config = {
      name: options.name,
      initializedAt: new Date().toISOString()
    };
    fs.writeFileSync(localFile, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`Initialized local agent configuration! Workspace name is set to: "${options.name}"`);
  });

// Commit command: routes file state to standard AgentRelayClient for local Seal encryption
program
  .command('commit')
  .description('Commit active agent state/logs using client-side encryption and update list')
  .argument('<message>', 'Brief description of the snapshot')
  .argument('<file>', 'Target file containing raw memory logs/JSON state to snapshot')
  .option('--ver <version>', 'Version tag for the memory file (e.g. 1.1.0)')
  .option('--importance <score>', 'Importance priority ranking score from 1 to 10', parseInt)
  .option('--source-link <link>', 'Associated origin source link or parent BlobID')
  .option('--visibility <visibility>', 'Visibility: pb (public) or pr (private)', 'pr')
  .action(async (message, file, options) => {
    const auth = getAuthCredentials();
    if (!auth) {
      console.log('Error: Not authenticated. Please run "ar login" first.');
      process.exit(1);
    }

    const visibility = options.visibility || 'pr';
    if (visibility !== 'pb' && visibility !== 'pr') {
      console.log('Error: Visibility must be either "pb" (public) or "pr" (private).');
      process.exit(1);
    }

    const ws = getWorkspaceConfig();
    if (!ws) {
      console.log('Error: Local configuration missing. Run "ar init --name <name>" first.');
      process.exit(1);
    }

    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.log(`Error: File "${file}" does not exist.`);
      process.exit(1);
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Instantiate standard SDK client
      const client = new AgentRelayClient({
        simulateMode: false,
        walrusServerUrl: BACKEND_URL
      });

      // Bind SDK logs to terminal output
      client.onLog((logMsg) => console.log(logMsg));

      let parentBlobId = options.sourceLink;
      if (!parentBlobId) {
        try {
          const resolveRes = await axios.get(`${BACKEND_URL}/api/agents/resolve/${ws.name}`);
          if (resolveRes.data?.agent?.current_blob_id) {
            parentBlobId = resolveRes.data.agent.current_blob_id;
          }
        } catch (e) {
          // Base agent record does not exist yet
        }
      }

      const sourceLinks = parentBlobId ? [parentBlobId] : [];

      // Call remember() method which executes client-side Seal encryption
      const blobId = await client.remember(
        ws.name, 
        {
          content: fileContent,
          message,
          timestamp: new Date().toISOString()
        },
        {
          version: options.ver,
          importance: options.importance,
          sourceLinks,
          visibility
        }
      );

      console.log(`Registering memory file mapping on backend list...`);
      // Update database registry
      await axios.post(
        `${BACKEND_URL}/api/agents/sync`,
        {
          name: ws.name,
          ownerEmail: auth.email,
          currentBlobId: blobId,
          parentBlobId: parentBlobId || null,
          importanceScore: options.importance,
          version: options.ver,
          sourceLinks,
          visibility
        },
        {
          headers: { Authorization: `Bearer ${auth.apiKey}` }
        }
      );

      console.log(`\nCommit Success! State synchronized on-chain.\nMessage: "${message}"`);
    } catch (error) {
      console.error('Commit operation failed:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  });

// Fork command: routes copied memory to SDK forkAgent implementation
program
  .command('fork')
  .description('Fork an existing agent memory copy into a new name')
  .argument('<parent_name>', 'Name of the parent agent state to clone')
  .requiredOption('--name <child_name>', 'Friendly name for the child branch')
  .action(async (parentName, options) => {
    const auth = getAuthCredentials();
    if (!auth) {
      console.log('Error: Not authenticated. Please run "ar login" first.');
      process.exit(1);
    }

    const childName = options.name;

    try {
      // Instantiate standard SDK client
      const client = new AgentRelayClient({
        simulateMode: false,
        walrusServerUrl: BACKEND_URL
      });

      // Bind SDK logs to console
      client.onLog((logMsg) => console.log(logMsg));

      console.log(`Resolving parent agent name: "${parentName}"...`);
      const resolveRes = await axios.get(`${BACKEND_URL}/api/agents/resolve/${parentName}`);
      const parentAgent = resolveRes.data.agent;

      // Restricts forking of private memories to their respective owners
      if (parentAgent) {
        const isOwner = parentAgent.owner_email === auth.email || parentAgent.owner_wallet_address === auth.email;
        if (parentAgent.visibility !== 'pb' && !isOwner) {
          console.log(`Error: Cannot fork another developer's private memory. Only public memories or your own agents' memories can be forked.`);
          process.exit(1);
        }
      }

      console.log(`Parent resolved. Invoking SDK forkAgent...`);
      // Fork agent memory mapping parent to child
      await client.forkAgent(parentName, childName);

      console.log(`Registering copied memory on backend list...`);
      await axios.post(
        `${BACKEND_URL}/api/agents/sync`,
        {
          name: childName,
          ownerEmail: auth.email,
          currentBlobId: parentAgent.current_blob_id,
          parentBlobId: parentAgent.current_blob_id
        },
        {
          headers: { Authorization: `Bearer ${auth.apiKey}` }
        }
      );

      console.log(`\nFork Success! Registered new branch: "${childName}"`);
      console.log(`Use "ar init --name ${childName}" inside a folder to work on this branch.`);
    } catch (error) {
      console.error('Fork operation failed:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  });

// Recall command downloads latest memory and prints compiled state
program
  .command('recall')
  .description('Recall latest agent memory state and output SYSTEM MEMORY INJECTION format')
  .option('--raw', 'Output the raw decrypted JSON manifest instead of formatted text')
  .action(async (options) => {
    const auth = getAuthCredentials();
    if (!auth) {
      console.log('Error: Not authenticated. Please run "ar login" first.');
      process.exit(1);
    }

    const ws = getWorkspaceConfig();
    if (!ws) {
      console.log('Error: Local configuration missing. Run "ar init --name <name>" first.');
      process.exit(1);
    }

    try {
      const client = new AgentRelayClient({
        simulateMode: false,
        walrusServerUrl: BACKEND_URL
      });

      const resolveRes = await axios.get(`${BACKEND_URL}/api/agents/resolve/${ws.name}`);
      const agent = resolveRes.data.agent;
      if (!agent || !agent.current_blob_id) {
        console.log(`Error: No active memory files found for agent: "${ws.name}"`);
        process.exit(1);
      }

      const manifest = await client.recall(agent.current_blob_id);

      if (options.raw) {
        console.log(JSON.stringify(manifest, null, 2));
      } else {
        const compiledText = client.compileSystemMemoryInjection(manifest);
        console.log(compiledText);
      }
    } catch (error) {
      console.error('Recall operation failed:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
