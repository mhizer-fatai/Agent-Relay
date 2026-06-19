import os
import json
import threading
import requests
from typing import Dict, Any, Optional

class AgentRelayMemoryEngine:
    """
    Core memory manager engine for AgentRelay.
    Provides session locking, SQL database caching (PostgreSQL/SQLite),
    asynchronous background thread backups, and token trimming.
    """
    # Global process-level locks map for thread synchronization
    _locks: Dict[str, threading.Lock] = {}
    _locks_lock = threading.Lock()

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
        self.agent_name = agent_name
        self.api_key = api_key or os.getenv("AGENTRELAY_API_KEY")
        self.visibility = visibility
        self.backend_url = backend_url or os.getenv("AGENTRELAY_BACKEND_URL", "https://agent-relay-backend.onrender.com")
        self.connection_string = connection_string
        self.sync_interval = sync_interval
        self.max_token_limit = max_token_limit
        self.enable_locking = enable_locking
        self.async_backup = async_backup
        self.blob_id = blob_id
        self.decryption_key = decryption_key

        # Tracks number of writes locally before doing a network sync
        self.write_count = 0

        # In-memory memory state fallback if no connection string is provided
        self.memory_state = {}

        if not self.api_key:
            raise ValueError(
                "AGENTRELAY_API_KEY is missing. "
                "Configure the key in the environment variables or constructor."
            )

        # Initialize SQL Cache tables if necessary
        if self.connection_string:
            self._init_db()

    def _get_lock(self) -> threading.Lock:
        """Returns the thread synchronization lock for this session name."""
        with self._locks_lock:
            if self.agent_name not in self._locks:
                self._locks[self.agent_name] = threading.Lock()
            return self._locks[self.agent_name]

    def _init_db(self):
        """Creates the cached memory table if it does not exist."""
        # SQLite local database cache
        if self.connection_string.startswith("sqlite:///"):
            import sqlite3
            db_path = self.connection_string.replace("sqlite:///", "")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS agentrelay_cache ("
                "agent_name TEXT PRIMARY KEY, "
                "data TEXT"
                ")"
            )
            conn.commit()
            conn.close()
        # PostgreSQL database cache
        elif self.connection_string.startswith("postgresql://") or self.connection_string.startswith("postgres://"):
            try:
                import psycopg2
            except ImportError:
                raise ImportError(
                    "Please install psycopg2-binary to use PostgreSQL database caching."
                )
            conn = psycopg2.connect(self.connection_string)
            cursor = conn.cursor()
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS agentrelay_cache ("
                "agent_name VARCHAR(255) PRIMARY KEY, "
                "data TEXT"
                ")"
            )
            conn.commit()
            cursor.close()
            conn.close()

    def _xor_bytes(self, data: bytes, key: str) -> bytes:
        """Applies symmetric key-based XOR bytes cipher to the input data."""
        key_bytes = key.encode('utf-8')
        if not key_bytes:
            return data
        return bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data))

    def get_memory(self) -> Dict[str, Any]:
        """Retrieves active memory state from SQL cache or memory cache."""
        lock = self._get_lock()
        
        # Guard retrieval with process-level lock if enabled
        if self.enable_locking:
            lock.acquire()

        try:
            if self.connection_string:
                # Retrieve from SQLite
                if self.connection_string.startswith("sqlite:///"):
                    import sqlite3
                    db_path = self.connection_string.replace("sqlite:///", "")
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    cursor.execute("SELECT data FROM agentrelay_cache WHERE agent_name = ?", (self.agent_name,))
                    row = cursor.fetchone()
                    conn.close()
                    if row:
                        return json.loads(row[0])
                # Retrieve from PostgreSQL
                elif self.connection_string.startswith("postgresql://") or self.connection_string.startswith("postgres://"):
                    import psycopg2
                    conn = psycopg2.connect(self.connection_string)
                    cursor = conn.cursor()
                    
                    # Row level locking SELECT FOR UPDATE if enabled
                    query = "SELECT data FROM agentrelay_cache WHERE agent_name = %s"
                    if self.enable_locking:
                        query += " FOR UPDATE"
                    
                    cursor.execute(query, (self.agent_name,))
                    row = cursor.fetchone()
                    cursor.close()
                    conn.close()
                    if row:
                        return json.loads(row[0])
                
                # If not found in DB, pull from backend Walrus index once to populate
                remote_data = self._recall_from_backend()
                if remote_data:
                    self._save_to_db(remote_data)
                    return remote_data
                return {}
            else:
                if not self.memory_state:
                    remote_data = self._recall_from_backend()
                    if remote_data:
                        self.memory_state = remote_data
                return self.memory_state
        finally:
            if self.enable_locking:
                lock.release()

    def save_memory(self, memory_data: Dict[str, Any]):
        """Persists memory state into SQL cache/memory, and syncs to Walrus based on constraints."""
        lock = self._get_lock()

        # Guard write operation with process-level lock if enabled
        if self.enable_locking:
            lock.acquire()

        try:
            # Feature 2: Token limit check & trimming
            if self.max_token_limit and "history" in memory_data:
                memory_data = self._trim_history_if_needed(memory_data)

            # Store locally in RAM or SQL Cache database
            if self.connection_string:
                self._save_to_db(memory_data)
            else:
                self.memory_state = memory_data

            # Increment count of local changes
            self.write_count += 1

            # Sync to Walrus immediately if no database cache exists, or at configured intervals
            if not self.connection_string or self.write_count >= self.sync_interval:
                self.write_count = 0
                if self.async_backup:
                    # Feature 4: Non-blocking background thread upload
                    thread = threading.Thread(target=self._upload_to_walrus, args=(memory_data,), daemon=True)
                    thread.start()
                else:
                    self._upload_to_walrus(memory_data)
        finally:
            if self.enable_locking:
                lock.release()

    def _save_to_db(self, memory_data: Dict[str, Any]):
        """Saves memory state inside the database table cache."""
        data_str = json.dumps(memory_data)
        if self.connection_string.startswith("sqlite:///"):
            import sqlite3
            db_path = self.connection_string.replace("sqlite:///", "")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO agentrelay_cache (agent_name, data) VALUES (?, ?)",
                (self.agent_name, data_str)
            )
            conn.commit()
            conn.close()
        elif self.connection_string.startswith("postgresql://") or self.connection_string.startswith("postgres://"):
            import psycopg2
            conn = psycopg2.connect(self.connection_string)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO agentrelay_cache (agent_name, data) VALUES (%s, %s) "
                "ON CONFLICT (agent_name) DO UPDATE SET data = EXCLUDED.data",
                (self.agent_name, data_str)
            )
            conn.commit()
            cursor.close()
            conn.close()

    def _trim_history_if_needed(self, memory_data: Dict[str, Any]) -> Dict[str, Any]:
        """Applies sliding window trimming if characters exceed estimated limit."""
        history = memory_data.get("history", [])
        if not history:
            return memory_data

        # Approximate token size using a standard estimation factor (4 characters = 1 token)
        total_chars = sum(len(str(msg)) for msg in history)
        estimated_tokens = total_chars // 4

        if estimated_tokens > self.max_token_limit:
            # Archive full raw state to Walrus in background before trimming active window
            if self.async_backup:
                thread = threading.Thread(target=self._upload_to_walrus, args=(memory_data,), daemon=True)
                thread.start()
            else:
                self._upload_to_walrus(memory_data)

            # Keep only the last 5 messages to shrink active context window size
            memory_data["history"] = history[-5:]
            # Inject a system marker informing the AI that history has been truncated and archived
            memory_data["history"].insert(0, {
                "type": "system",
                "data": {
                    "content": "[System Note: Older chat history has been archived. Key context was summarized.]"
                }
            })

        return memory_data

    def _upload_to_walrus(self, memory_data: Dict[str, Any]):
        """Uploads memory state to Walrus Testnet through the AgentRelay server."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        try:
            if self.decryption_key:
                verify_res = requests.get(f"{self.backend_url}/api/auth/verify", headers=headers)
                if verify_res.status_code != 200:
                    print(f"Warning: API Key verification failed: {verify_res.status_code} - {verify_res.text}")
                    return
                user = verify_res.json().get("user", {})
                owner_email = user.get("email") or user.get("wallet_address")
                if not owner_email:
                    print("Warning: Owner email or address not found in profile")
                    return

                import base64
                payload_str = json.dumps(memory_data)
                payload_bytes = payload_str.encode('utf-8')
                encrypted_bytes = self._xor_bytes(payload_bytes, self.decryption_key)
                base64_content = base64.b64encode(encrypted_bytes).decode('utf-8')

                upload_res = requests.post(
                    f"{self.backend_url}/api/walrus/upload",
                    json={"content": base64_content},
                    headers=headers
                )
                if upload_res.status_code != 200:
                    print(f"Warning: Walrus upload failed: {upload_res.status_code} - {upload_res.text}")
                    return
                
                new_blob_id = upload_res.json().get("blobId")
                if not new_blob_id:
                    print("Warning: No blobId returned in upload response")
                    return

                self.blob_id = new_blob_id

                sync_payload = {
                    "name": self.agent_name,
                    "ownerEmail": owner_email,
                    "currentBlobId": new_blob_id,
                    "visibility": self.visibility
                }
                sync_res = requests.post(
                    f"{self.backend_url}/api/agents/sync",
                    json=sync_payload,
                    headers=headers
                )
                if sync_res.status_code != 200:
                    print(f"Warning: Database sync failed: {sync_res.status_code} - {sync_res.text}")
            else:
                payload = {
                    "name": self.agent_name,
                    "context": memory_data,
                    "version": "1.1.0",
                    "visibility": self.visibility
                }
                res = requests.post(f"{self.backend_url}/api/agents/remember", json=payload, headers=headers)
                if res.status_code != 200:
                    print(f"Warning: AgentRelay background sync failed: {res.status_code} - {res.text}")
                else:
                    new_blob_id = res.json().get("blobId")
                    if new_blob_id:
                        self.blob_id = new_blob_id
        except Exception as e:
            print(f"Error: Connection to AgentRelay backend failed during background sync: {e}")

    def _recall_from_backend(self) -> Dict[str, Any]:
        """Recalls memory state from backend metadata store or directly via blob_id."""
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            if not self.blob_id and self.decryption_key:
                res = requests.get(f"{self.backend_url}/api/agents/resolve/{self.agent_name}", headers=headers)
                if res.status_code == 200:
                    agent = res.json().get("agent", {})
                    if agent and agent.get("current_blob_id"):
                        self.blob_id = agent.get("current_blob_id")

            if self.blob_id:
                url = f"{self.backend_url}/api/walrus/download/{self.blob_id}"
                res = requests.get(url, headers=headers)
                if res.status_code == 200:
                    content = res.text
                    if self.decryption_key:
                        import base64
                        encrypted_bytes = base64.b64decode(content)
                        decrypted_bytes = self._xor_bytes(encrypted_bytes, self.decryption_key)
                        manifest_str = decrypted_bytes.decode('utf-8')
                        return json.loads(manifest_str)
                    else:
                        try:
                            import base64
                            decoded_str = base64.b64decode(content).decode('utf-8')
                            return json.loads(decoded_str)
                        except Exception:
                            return json.loads(content)
            else:
                res = requests.get(f"{self.backend_url}/api/agents/recall/{self.agent_name}", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("manifest", {})
        except Exception as e:
            print(f"Error: Connection to AgentRelay backend failed during recall fetch: {e}")
        return {}
