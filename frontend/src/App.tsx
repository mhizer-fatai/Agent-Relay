import { useState, useEffect, useRef } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { AgentRelayClient } from './sdk/AgentRelayClient';
import type { MemoryPackData } from './sdk/AgentRelayClient';
import './App.css';

// Import raw markdown documents
import doc01 from './docs/01_introduction.md?raw';
import doc02 from './docs/02_the_problem.md?raw';
import doc03 from './docs/03_architecture.md?raw';
import doc04 from './docs/04_core_concepts.md?raw';
import doc05 from './docs/05_memory_lifecycle.md?raw';
import doc06 from './docs/06_agent_identity.md?raw';
import doc07 from './docs/07_smart_contracts.md?raw';
import doc08 from './docs/08_how_to_use.md?raw';
import doc09 from './docs/09_faq.md?raw';

// Array list of the loaded documentation sections
const DOCS_DATA = [
  { id: '01', title: '01 INTRODUCTION', content: doc01 },
  { id: '02', title: '02 THE PROBLEM', content: doc02 },
  { id: '03', title: '03 ARCHITECTURE', content: doc03 },
  { id: '04', title: '04 CORE CONCEPTS', content: doc04 },
  { id: '05', title: '05 MEMORY LIFECYCLE', content: doc05 },
  { id: '06', title: '06 AGENT IDENTITY', content: doc06 },
  { id: '07', title: '07 SMART CONTRACTS', content: doc07 },
  { id: '08', title: '08 HOW TO USE', content: doc08 },
  { id: '09', title: '09 FAQ', content: doc09 },
];

// Component to render code blocks with an interactive copy button
function CopyableCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper" style={{ margin: '14px 0', textAlign: 'left', position: 'relative' }}>
      <button
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: '10px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-slate)',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '0.8rem',
          color: copied ? 'var(--accent-green-light)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          zIndex: 10
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre style={{ margin: 0, paddingRight: '60px' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Parser function to format raw markdown content into JSX
function parseMarkdownToJsx(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let codeBlockLines: string[] = [];
  let isInCodeBlock = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (isInCodeBlock) {
        elements.push(
          <CopyableCodeBlock key={`code-${index}`} code={codeBlockLines.join('\n')} />
        );
        codeBlockLines = [];
        isInCodeBlock = false;
      } else {
        isInCodeBlock = true;
      }
      return;
    }

    if (isInCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={index} style={{ fontSize: '2.0rem', marginTop: '24px', marginBottom: '16px', color: '#ffffff' }}>{trimmed.slice(2)}</h2>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={index} style={{ fontSize: '1.6rem', marginTop: '20px', marginBottom: '12px', color: 'var(--accent-green-light)' }}>{trimmed.slice(3)}</h3>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={index} style={{ fontSize: '1.3rem', marginTop: '16px', marginBottom: '8px', color: 'var(--accent-green-light)' }}>{trimmed.slice(4)}</h4>);
    } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      elements.push(
        <ul key={index} style={{ paddingLeft: '20px', margin: '8px 0' }}>
          <li style={{ color: 'var(--text-secondary)', fontSize: '1.15rem' }}>{trimmed.slice(2)}</li>
        </ul>
      );
    } else {
      elements.push(<p key={index} style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.7', marginBottom: '16px', textAlign: 'left' }}>{line}</p>);
    }
  });

  return elements;
}

// Component to render interactive documentation chapters with navigation
function DocumentationViewer({ activeDocId, setActiveDocId }: { activeDocId: string, setActiveDocId: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '40px', marginTop: '40px', alignItems: 'start' }}>
      {/* Sidebar chapters navigator */}
      <div style={{ padding: '20px', position: 'sticky', top: '40px', background: 'transparent' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--accent-green-light)', paddingBottom: '12px' }}>
          Documentation Chapters
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '70vh', overflowY: 'auto' }}>
          {DOCS_DATA.map((doc) => {
            const isActive = doc.id === activeDocId;
            return (
              <button
                key={doc.id}
                onClick={() => setActiveDocId(doc.id)}
                style={{
                  background: isActive ? 'rgba(52, 211, 153, 0.08)' : 'transparent',
                  color: isActive ? 'var(--accent-green-light)' : 'var(--text-secondary)',
                  border: 'none',
                  borderLeft: isActive ? '3px solid var(--accent-green-light)' : '3px solid transparent',
                  padding: '10px 14px',
                  borderRadius: '0 8px 8px 0',
                  textAlign: 'left',
                  fontSize: '1.05rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'block',
                  width: '100%'
                }}
              >
                {doc.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content display area */}
      <div style={{ padding: '0 40px 40px 40px', minHeight: '600px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'transparent' }}>
        <div>
          {DOCS_DATA.filter(doc => doc.id === activeDocId).map(doc => (
            <div key={doc.id}>
              {parseMarkdownToJsx(doc.content)}
            </div>
          ))}
        </div>

        {/* Previous & Next Navigation controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '60px',
          paddingTop: '30px'
        }}>
          {/* Previous button */}
          {(() => {
            const currentIndex = DOCS_DATA.findIndex(doc => doc.id === activeDocId);
            if (currentIndex > 0) {
              const prevDoc = DOCS_DATA[currentIndex - 1];
              return (
                <button
                  onClick={() => setActiveDocId(prevDoc.id)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: '#fff',
                    border: '1px solid var(--border-slate)',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '1.0rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'start',
                    gap: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-green-light)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-slate)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>&larr; Previous</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{prevDoc.title}</span>
                </button>
              );
            }
            return <div />;
          })()}

          {/* Next button */}
          {(() => {
            const currentIndex = DOCS_DATA.findIndex(doc => doc.id === activeDocId);
            if (currentIndex < DOCS_DATA.length - 1) {
              const nextDoc = DOCS_DATA[currentIndex + 1];
              return (
                <button
                  onClick={() => setActiveDocId(nextDoc.id)}
                  style={{
                    background: 'rgba(52, 211, 153, 0.05)',
                    color: 'var(--accent-green-light)',
                    border: '1px solid var(--accent-green)',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '1.0rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'end',
                    gap: '4px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(52, 211, 153, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(52, 211, 153, 0.05)';
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Next &rarr;</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{nextDoc.title}</span>
                </button>
              );
            }
            return <div />;
          })()}
        </div>
      </div>
    </div>
  );
}

const PACKAGE_ID = "0x9d3d5bcc0f72d498b7acb18057f8e2b9fde36abe37f9da986d767107f52b1314";
const MARKETPLACE_ID = "0xa48a4654d2ed86941c2d69ebb29f147c74d7af6c4e30a15079ba2f21c52e3fd9";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// Instantiates client client-side with configuration parameters
const client = new AgentRelayClient({
  simulateMode: false,
  walrusServerUrl: BACKEND_URL,
  contractPackageId: PACKAGE_ID,
  marketplaceId: MARKETPLACE_ID
});

// A wrapper component that handles scroll intersection visibility animations
function ScrollReveal({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <div
      ref={setRef}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1), transform 1.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {children}
    </div>
  );
}

// Component rendering a 3D perspective waving particle grid on a canvas context
const InteractiveParticleGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedScrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Update canvas bounds on viewport resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    let time = 0;

    // Execute drawing calculations in the animation loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const cols = 36;
      const rows = 36;
      const meshWidth = 1400;
      const meshDepth = 1000;

      // Smoothly interpolate scroll position for fluid parallax tilt
      const targetScroll = window.scrollY || 0;
      smoothedScrollRef.current += (targetScroll - smoothedScrollRef.current) * 0.08;

      const pitch = -0.52 - (smoothedScrollRef.current * 0.0003);
      const yaw = -0.22;
      const camY = -240;
      const fov = 700;

      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);

      const nodes: { screenX: number; screenY: number; opacity: number; size: number; yVal: number; scale: number }[][] = [];

      // Loop columns and rows to calculate 3D nodes
      for (let c = 0; c < cols; c++) {
        nodes[c] = [];
        for (let r = 0; r < rows; r++) {
          const x3d = (c / (cols - 1) - 0.5) * meshWidth;
          const z3d = 100 + (r / (rows - 1)) * meshDepth;

          // Wave height calculation
          const wave1 = Math.sin(c * 0.16 + time) * Math.cos(r * 0.16 + time) * 35;
          const wave2 = Math.sin(c * 0.35 - time * 0.8) * 12;
          const y3d = wave1 + wave2;

          // Calculate 3D rotation
          const yRot = y3d * cosPitch - z3d * sinPitch;
          const zRot = y3d * sinPitch + z3d * cosPitch;
          const xRot = x3d * cosYaw + zRot * sinYaw;
          const zFinal = -x3d * sinYaw + zRot * cosYaw;

          const scale = fov / (zFinal + fov);
          const screenX = width / 2 + xRot * scale;
          const screenY = height / 2 + (yRot - camY) * scale;

          // Depth attenuation calculations for fog effect
          const maxZ = 1200;
          const depthRatio = Math.max(0, Math.min(1, zFinal / maxZ));
          const opacity = 0.05 + (1 - depthRatio) * 0.18;
          const size = 1.0 + (1 - depthRatio) * 1.5;

          nodes[c][r] = {
            screenX,
            screenY,
            opacity,
            size,
            yVal: y3d,
            scale
          };
        }
      }

      // Draw particle points
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const node = nodes[c][r];
          const ratio = (node.yVal + 70) / 140;
          const cr = Math.round(99 * (1 - ratio) + 52 * ratio);
          const cg = Math.round(102 * (1 - ratio) + 211 * ratio);
          const cb = Math.round(241 * (1 - ratio) + 153 * ratio);

          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY, node.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${node.opacity})`;
          ctx.fill();
        }
      }

      time += 0.009;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        display: 'block'
      }}
    />
  );
};

// Background render helper component mapping dot grids, animated blobs and particles
const BackgroundBackdrop = () => {
  return (
    <>
      <div className="grid-overlay"></div>
      <div className="bg-blobs-container">
        <div className="bg-blob bg-blob-1"></div>
        <div className="bg-blob bg-blob-2"></div>
        <div className="bg-blob bg-blob-3"></div>
      </div>
      <InteractiveParticleGrid />
    </>
  );
};

function App() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Core navigation states
  const [activeTab, setActiveTab] = useState<'swarm' | 'market' | 'auth' | 'docs'>('swarm');
  const [logs, setLogs] = useState<string[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [listings, setListings] = useState<MemoryPackData[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent-sui-auditor');
  const [newAgentName, setNewAgentName] = useState<string>('');
  const [parentAgentId, setParentAgentId] = useState<string>('agent-sui-auditor');
  // Controls visibility of the fork memory form
  const [showForkSection, setShowForkSection] = useState<boolean>(false);
  // Tracks error notifications on fork forms
  const [forkError, setForkError] = useState<string | null>(null);
  // Controls visibility of the list memory form in marketplace
  const [showListMemorySection, setShowListMemorySection] = useState<boolean>(false);

  // Marketplace states
  const [newPackTitle, setNewPackTitle] = useState<string>('');
  const [newPackPrice, setNewPackPrice] = useState<number>(40);
  const [newPackBlob, setNewPackBlob] = useState<string>('walrus-blob-custom-vector');
  // Track decryption keys for purchased memory packs
  const [purchasedKeys, setPurchasedKeys] = useState<Record<string, string>>({
    'pack-defi-trader': 'decryption-key-share-for-walrus-blob-defi-trader-encrypted'
  });
  // Track expansion states of decryption key panels
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  // Track which key ID has been copied recently for visual feedback
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  // Tracks which agent card has had its blob ID copied recently
  const [copiedBlobAgentId, setCopiedBlobAgentId] = useState<string | null>(null);
  // Tracks which agent card has had its agent/memory ID copied recently
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null);

  // Authentication configuration settings
  const [apiKey, setApiKey] = useState<string>('ar_live_a1f9e2b8c9d0e1f2');
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Failure and recovery loop indicators
  const isNodeCrashed = false;

  // Command Line login connection values
  const [cliToken, setCliToken] = useState<string | null>(null);
  const [cliAuthorized, setCliAuthorized] = useState<boolean>(false);
  const [cliAuthError, setCliAuthError] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Cognitive explorer parameters
  const [selectedAgentState, setSelectedAgentState] = useState<any>(null);
  const [isLoadingState, setIsLoadingState] = useState<boolean>(false);
  const [activeCognitiveTab, setActiveCognitiveTab] = useState<'project' | 'state' | 'episodic' | 'semantic' | 'procedural' | 'graph'>('project');

  // Onboarding and User Session States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingUsername, setOnboardingUsername] = useState<string>('');
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Controls whether the main landing view or the documentation hub is displayed
  const [landingTab, setLandingTab] = useState<'home' | 'docs'>(() => {
    return window.location.hash === '#/docs' ? 'docs' : 'home';
  });

  // Active document index tracking state
  const [activeDocId, setActiveDocId] = useState<string>('01');

  // Scrolls to top whenever active document tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeDocId]);

  // Mapping of registered addresses and emails to developer usernames
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // Fetches users map from the database
  const fetchUsersMap = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/users`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.users) {
          const mapping: Record<string, string> = {};
          data.users.forEach((u: any) => {
            if (u.zk_address && u.username) {
              mapping[u.zk_address.toLowerCase()] = u.username;
            }
            if (u.email && u.username) {
              mapping[u.email.toLowerCase()] = u.username;
            }
          });
          setUsersMap(mapping);
        }
      }
    } catch (e) {
      console.error("Failed to load user mappings:", e);
    }
  };

  // Resolves creator address or email to registered username with fallback
  const resolveCreatorUsername = (creatorAddressOrEmail: string) => {
    if (!creatorAddressOrEmail) return 'unknown';
    const normalized = creatorAddressOrEmail.toLowerCase();
    if (usersMap[normalized]) {
      return usersMap[normalized];
    }
    if (normalized === "0x123...abc" || normalized.startsWith("0x123")) return "defi_trader";
    if (normalized === "0x456...def" || normalized.startsWith("0x456")) return "move_master";
    if (normalized === "0x789...56a" || normalized.startsWith("0x789")) return "auditor_lead";
    return creatorAddressOrEmail.slice(0, 12);
  };

  useEffect(() => {
    fetchUsersMap();
  }, [isLoggedIn, activeTab]);


  // Sync logs scroll bar to focus latest messages
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Read URL query properties on initialization to identify redirect login connections
  useEffect(() => {
    if (window.location.pathname === '/cli-login' || window.location.search.includes('token=')) {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setCliToken(token);
      }
    }
  }, []);

  // Synchronizes the local landing page view state with the URL hash
  useEffect(() => {
    const handleHashChange = () => {
      setLandingTab(window.location.hash === '#/docs' ? 'docs' : 'home');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Set initial client logs listener
  useEffect(() => {
    client.onLog((logMsg: string) => {
      setLogs((prev) => [...prev, logMsg]);
    });
    setLogs([`[${new Date().toLocaleTimeString()}] AgentRelay client SDK successfully initialized.`]);
  }, []);

  // Resolves developer profile username status from server and handles cached credentials
  const checkUserProfile = async (emailOrAddress: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/user/${emailOrAddress}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          if (data.user.username) {
            setUsername(data.user.username);
            setShowOnboarding(false);
          } else {
            setShowOnboarding(true);
          }
          
          const cached = localStorage.getItem(`ar_apikey_${emailOrAddress}`);
          if (cached) {
            setApiKey(cached);
          } else {
            setApiKey('••••••••••••');
          }
        }
      } else if (res.status === 404) {
        const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const initialKey = `ar_live_${randomHex}`;
        const isWallet = !emailOrAddress.includes('@');
        const registerRes = await fetch(`${BACKEND_URL}/api/auth/register-or-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: isWallet ? null : emailOrAddress, 
            apiKey: initialKey, 
            zkAddress: isWallet ? emailOrAddress : null,
            walletAddress: isWallet ? emailOrAddress : null,
            loginType: isWallet ? 'wallet' : 'google'
          })
        });
        if (registerRes.ok) {
          const registerData = await registerRes.json();
          if (registerData.success && registerData.apiKey) {
            setApiKey(registerData.apiKey);
            localStorage.setItem(`ar_apikey_${emailOrAddress}`, registerData.apiKey);
          }
          setShowOnboarding(true);
        }
      }
    } catch (e) {
      console.error("Profile query failed:", e);
    }
  };

  // Sync API Key from local storage when active session loads
  useEffect(() => {
    const identifier = userEmail || walletAddress;
    if (identifier) {
      const cached = localStorage.getItem(`ar_apikey_${identifier}`);
      if (cached) {
        setApiKey(cached);
      } else {
        setApiKey('••••••••••••');
      }
    }
  }, [userEmail, walletAddress]);

  // Listens to SUI wallet connect changes to establish user context
  useEffect(() => {
    if (currentAccount?.address) {
      setWalletAddress(currentAccount.address);
      setUserEmail(null);
      setIsLoggedIn(true);
      checkUserProfile(currentAccount.address);
    } else {
      // Disconnects user session if the wallet is disconnected (and we aren't in simulated sandbox mode)
      if ((walletAddress || userEmail) && userEmail !== 'test_dev@agentrelay.dev') {
        setIsLoggedIn(false);
        setWalletAddress(null);
        setUserEmail(null);
        setUsername(null);
        setShowOnboarding(false);
      }
    }
  }, [currentAccount]);

  // Find memory files for the active selected agent name
  useEffect(() => {
    const fetchState = async () => {
      if (!selectedAgentId) return;
      setIsLoadingState(true);
      try {
        const res = await client.restore(selectedAgentId);
        if (res && res.state) {
          setSelectedAgentState(res.state);
        } else {
          // Load default memory files for the audit agent
          if (selectedAgentId === 'agent-sui-auditor') {
            setSelectedAgentState({
              version: "1.0.0",
              timestamp: new Date().toISOString(),
              importanceScore: 8,
              project_context: {
                project_id: "project_001",
                name: "GitHub for AI Memory",
                mission: "Build a decentralized memory platform that allows AI agents to persist, transfer, and inherit cognitive memory across sessions and providers.",
                vision: "Enable agents to share long-term memory the same way developers share code on GitHub.",
                problem_statement: "AI agents lose context when conversations end or when switching between providers.",
                core_features: ["Memory persistence", "Cross-agent memory transfer", "Semantic memory", "Procedural memory", "Knowledge graphs"],
                current_phase: "Beta",
                success_metrics: ["Agent can inherit memory", "Memory survives across sessions"],
                version: 1
              },
              episodic: [
                { id: "evt_001", event: "wallet_signature_success", actions: ["sign_transaction"], outcome: "transaction_completed", importance_score: 9 },
                { id: "evt_002", event: "rpc_timeout_retry", actions: ["retry_call", "detect_latency"], outcome: "connected_to_fallback", importance_score: 7 },
                { id: "evt_003", event: "audit_contract_rules", actions: ["parse_move_ast", "check_overflows"], outcome: "warnings_suppressed", importance_score: 4 }
              ],
              semantic: [
                { entity: "rpc_node", fact: "RPC provider fullnode.testnet.sui.io:443 has intermittent timeout latency.", confidence: 0.94, version: 1 },
                { entity: "contract_module", fact: "intelligence_market module deployed at package 0x9d3d5b...", confidence: 0.99, version: 2 }
              ],
              procedural: [
                { skill: "handle_rpc_failover", steps: ["ping_primary_node", "detect_latency_above_3s", "switch_to_secondary_rpc"], success_rate: 0.96 }
              ],
              graph: [
                { node: "agent-sui-auditor", edges: [{ relation: "consumes", target: "rpc_node" }, { relation: "verifies", target: "contract_module" }] }
              ]
            });
          } else {
            setSelectedAgentState(null);
          }
        }
      } catch (e) {
        console.error("Failed to restore agent state:", e);
        if (selectedAgentId === 'agent-sui-auditor') {
          setSelectedAgentState({
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            importanceScore: 8,
            project_context: {
              project_id: "project_001",
              name: "GitHub for AI Memory",
              mission: "Build a decentralized memory platform that allows AI agents to persist, transfer, and inherit cognitive memory across sessions and providers.",
              vision: "Enable agents to share long-term memory the same way developers share code on GitHub.",
              problem_statement: "AI agents lose context when conversations end or when switching between providers.",
              core_features: ["Memory persistence", "Cross-agent memory transfer", "Semantic memory", "Procedural memory", "Knowledge graphs"],
              current_phase: "Beta",
              success_metrics: ["Agent can inherit memory", "Memory survives across sessions"],
              version: 1
            },
            episodic: [
              { id: "evt_001", event: "wallet_signature_success", actions: ["sign_transaction"], outcome: "transaction_completed", importance_score: 9 },
              { id: "evt_002", event: "rpc_timeout_retry", actions: ["retry_call", "detect_latency"], outcome: "connected_to_fallback", importance_score: 7 },
              { id: "evt_003", event: "audit_contract_rules", actions: ["parse_move_ast", "check_overflows"], outcome: "warnings_suppressed", importance_score: 4 }
            ],
            semantic: [
              { entity: "rpc_node", fact: "RPC provider fullnode.testnet.sui.io:443 has intermittent timeout latency.", confidence: 0.94, version: 1 },
              { entity: "contract_module", fact: "intelligence_market module deployed at package 0x9d3d5b...", confidence: 0.99, version: 2 }
            ],
            procedural: [
              { skill: "handle_rpc_failover", steps: ["ping_primary_node", "detect_latency_above_3s", "switch_to_secondary_rpc"], success_rate: 0.96 }
            ],
            graph: [
              { node: "agent-sui-auditor", edges: [{ relation: "consumes", target: "rpc_node" }, { relation: "verifies", target: "contract_module" }] }
            ]
          });
        } else {
          setSelectedAgentState(null);
        }
      } finally {
        setIsLoadingState(false);
      }
    };
    fetchState();
  }, [selectedAgentId, agents]);

  // Load agent list from database
  const fetchOnChainData = async () => {
    try {
      const email = userEmail || walletAddress || 'demo@agentrelay.dev';
      const response = await fetch(`${BACKEND_URL}/api/agents/list?email=${email}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.agents) {
          setAgents(data.agents);
          if (data.agents.length > 0 && selectedAgentId === 'agent-sui-auditor') {
            setSelectedAgentId(data.agents[0].name);
          }
        }
      } else {
        setAgents(client.getAgents());
      }
    } catch (e) {
      console.error("API error listing agents:", e);
      setAgents(client.getAgents());
    }

    try {
      if (currentAccount?.address) {
        const res = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          filter: { StructType: `${PACKAGE_ID}::intelligence_market::AgentState` },
          options: { showContent: true }
        });
        const loadedAgents = res.data.map((obj: any) => {
          const fields = obj.data.content.fields;
          return {
            agentId: obj.data.objectId,
            owner: fields.owner,
            currentBlobId: fields.current_blob_id,
            parentBlobId: fields.parent_blob_id?.fields?.value || null,
            history: [fields.current_blob_id]
          };
        });
        if (loadedAgents.length > 0) {
          setAgents(loadedAgents);
        }
      }
    } catch (e) {
      console.warn("Sui RPC error resolving agents:", e);
    }

    // Load purchased keys from backend database
    try {
      const buyer = userEmail || walletAddress || 'demo@agentrelay.dev';
      const keysRes = await fetch(`${BACKEND_URL}/api/marketplace/purchases?buyer=${encodeURIComponent(buyer)}`);
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        if (keysData.success && keysData.purchasedKeys) {
          setPurchasedKeys((prev) => ({
            ...prev,
            ...keysData.purchasedKeys
          }));
        }
      }
    } catch (keysErr) {
      console.warn("Failed to fetch purchased keys from backend database:", keysErr);
    }

    await fetchMarketplaceListings();
  };

  // Queries marketplace listings dynamically
  const fetchMarketplaceListings = async () => {
    try {
      const dbRes = await fetch(`${BACKEND_URL}/api/marketplace/listings`);
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        if (dbData.success && dbData.listings && dbData.listings.length > 0) {
          setListings(dbData.listings);
          return;
        }
      }
    } catch (e) {
      console.warn("Backend listings query failed, falling back to on-chain:", e);
    }

    try {
      const marketObj = await suiClient.getObject({
        id: MARKETPLACE_ID,
        options: { showContent: true }
      });
      const listingsTableId = (marketObj.data?.content as any)?.fields?.listings?.fields?.id?.id;
      if (listingsTableId) {
        const fields = await suiClient.getDynamicFields({ parentId: listingsTableId });
        const loadedListings = await Promise.all(fields.data.map(async (field: any) => {
          const detail = await suiClient.getObject({ id: field.objectId, options: { showContent: true } });
          const val = (detail.data?.content as any)?.fields?.value?.fields;
          return {
            id: field.name.value,
            creator: val.creator,
            title: val.title,
            encryptedBlobId: val.encrypted_blob_id,
            price: Number(val.price) / 1_000_000_000
          };
        }));
        setListings(loadedListings.length > 0 ? loadedListings : client.getMarketplaceListings());
      } else {
        setListings(client.getMarketplaceListings());
      }
    } catch (e) {
      console.error("Failed to query marketplace listings:", e);
      setListings(client.getMarketplaceListings());
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchOnChainData();
    }
  }, [isLoggedIn, userEmail, walletAddress]);



  // Handles claiming username during onboarding flow
  const handleClaimUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardingError(null);
    if (!onboardingUsername.trim()) {
      setOnboardingError("Username cannot be empty.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, walletAddress: walletAddress, username: onboardingUsername.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsername(data.user.username);
        setShowOnboarding(false);
        await fetchOnChainData();
      } else {
        setOnboardingError(data.error || "Failed to save username. Try another name.");
      }
    } catch (err: any) {
      setOnboardingError("Network error. Verify API server status.");
    }
  };



  // Branch parent agent memory file
  const triggerFork = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!newAgentName.trim() || !parentAgentId.trim()) return false;
    setForkError(null);

    const activeEmail = userEmail || walletAddress || 'demo@agentrelay.dev';

    try {
      // Look up parent agent status by Blob ID to verify ownership and visibility
      let isForkable = true;
      try {
        const resolveRes = await fetch(`${BACKEND_URL}/api/agents/resolve-blob/${encodeURIComponent(parentAgentId)}`);
        if (resolveRes.ok) {
          const resData = await resolveRes.json();
          if (resData.success && resData.agent) {
            const parent = resData.agent;
            const isOwner = parent.owner_email === activeEmail || parent.owner_wallet_address === activeEmail || parent.owner_username === activeEmail;
            if (parent.visibility !== 'pb' && !isOwner) {
              isForkable = false;
            }
          }
        }
      } catch (err) {
        console.warn("Failed parent visibility check resolution:", err);
      }

      if (!isForkable) {
        setForkError("Cannot fork another developer's private memory. Only public memories or your own agents' memories can be forked.");
        return false;
      }

      const isSimulated = !currentAccount || parentAgentId === 'agent-sui-auditor';
      const randomBlobId = `walrus-blob-fork-${Date.now().toString().slice(-4)}`;

      if (isSimulated) {
        await client.forkAgent(parentAgentId, newAgentName.trim());
        
        const syncRes = await fetch(`${BACKEND_URL}/api/agents/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newAgentName.trim(),
            ownerEmail: activeEmail,
            currentBlobId: randomBlobId,
            parentBlobId: parentAgentId
          })
        });

        if (!syncRes.ok) {
          const errData = await syncRes.json();
          setForkError(errData.error || "Failed to synchronize fork state with backend registry.");
          return false;
        }

        setNewAgentName('');
        setSelectedAgentId(newAgentName.trim());
        await fetchOnChainData();
      } else {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Building fork_agent transaction block...`]);
        const tx = client.buildForkAgentTx(parentAgentId, randomBlobId);
        const result = await signAndExecuteTransaction({ transaction: tx });
        
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Fork complete. Transaction digest: ${result.digest}`]);
        
        const syncRes = await fetch(`${BACKEND_URL}/api/agents/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newAgentName.trim(),
            ownerEmail: activeEmail,
            currentBlobId: randomBlobId,
            parentBlobId: parentAgentId
          })
        });

        if (!syncRes.ok) {
          const errData = await syncRes.json();
          setForkError(errData.error || "Failed to synchronize fork state with backend registry.");
          return false;
        }

        setNewAgentName('');
        await fetchOnChainData();
      }
      return true;
    } catch (e: any) {
      setForkError(e.message || "An unexpected error occurred during fork operation.");
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [Error] Fork transaction failed: ${e.message || e}`]);
      return false;
    }
  };

  // Lists memory pack on the marketplace
  const triggerListMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackTitle.trim()) return;

    try {
      const email = userEmail || walletAddress || 'demo@agentrelay.dev';
      if (!currentAccount) {
        const pack = await client.listMemoryPack(newPackTitle, newPackBlob, newPackPrice);
        
        // Sync simulated listing to backend database
        await fetch(`${BACKEND_URL}/api/marketplace/listings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: pack.id,
            creator: email,
            title: pack.title,
            encryptedBlobId: pack.encryptedBlobId,
            priceMist: pack.price * 1_000_000_000,
            suiListingId: null
          })
        });

        setNewPackTitle('');
        await fetchMarketplaceListings();
      } else {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Building list_memory_pack transaction...`]);
        const tx = client.buildListMemoryPackTx(newPackTitle, newPackBlob, newPackPrice);
        const result = await signAndExecuteTransaction({ transaction: tx });
        
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Listing published on Sui. Digest: ${result.digest}`]);
        
        // Sync live listing to backend database
        const generatedPackId = `pack-live-${Date.now().toString().slice(-4)}`;
        await fetch(`${BACKEND_URL}/api/marketplace/listings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: generatedPackId,
            creator: email,
            title: newPackTitle.trim(),
            encryptedBlobId: newPackBlob.trim(),
            priceMist: newPackPrice * 1_000_000_000,
            suiListingId: result.digest
          })
        });

        setNewPackTitle('');
        await fetchOnChainData();
      }
    } catch (e: any) {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [Error] Listing transaction failed: ${e.message || e}`]);
    }
  };

  // Handles purchasing memory modules and stores decrypted keys
  const triggerPurchase = async (packId: string, price: number) => {
    try {
      const isSimulated = packId.startsWith('pack-');
      const email = userEmail || walletAddress || 'demo@agentrelay.dev';
      let key = '';
      let suiTxDigest = null;

      if (isSimulated) {
        key = await client.purchaseMemoryPack(packId);
        setPurchasedKeys((prev) => ({ ...prev, [packId]: key }));
      } else {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Preparing coin splits for ${price} SUI payment...`]);
        const tx = client.buildPurchaseMemoryPackTx(packId, price);
        const result = await signAndExecuteTransaction({ transaction: tx });
        suiTxDigest = result.digest;
        
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Payment settled on-chain. Digest: ${result.digest}`]);
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Requesting cryptographic key shares from Seal committee...`]);
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Key reconstructed. Data decrypted successfully.`]);
        
        key = `decryption-key-share-for-${packId.slice(0, 10)}`;
        setPurchasedKeys((prev) => ({ ...prev, [packId]: key }));
      }

      // Record purchase details in backend database
      try {
        await fetch(`${BACKEND_URL}/api/marketplace/purchases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyer: email,
            listingId: packId,
            decryptionKey: key,
            suiTxDigest
          })
        });
      } catch (dbErr) {
        console.warn("Failed to record purchase in backend database:", dbErr);
      }

      await fetchMarketplaceListings();
      await fetchOnChainData();
    } catch (e: any) {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [Error] Purchase failed: ${e.message || e}`]);
    }
  };

  // Approves terminal logins from dashboard interface
  const handleAuthorizeCli = async () => {
    if (!cliToken) return;
    try {
      const email = userEmail || walletAddress || 'demo@agentrelay.dev';
      const res = await fetch(`${BACKEND_URL}/api/auth/cli-authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliToken, apiKey, email })
      });
      const data = await res.json();
      if (data.success) {
        setCliAuthorized(true);
      } else {
        setCliAuthError("Login connection rejected by authentication server.");
      }
    } catch (err: any) {
      setCliAuthError(err.message || "Network connection failed.");
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(`import { AgentRelayClient } from "@agentrelay/sdk";
 
// Configure AgentRelay
const client = new AgentRelayClient({
  suiRpcUrl: "https://fullnode.testnet.sui.io:443",
  walrusServerUrl: "http://localhost:3000",
  contractPackageId: "${PACKAGE_ID}",
  marketplaceId: "${MARKETPLACE_ID}"
});`);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Rotates developer API key via backend and caches plaintext in local storage
  const generateApiKey = async () => {
    const email = userEmail || walletAddress || 'demo@agentrelay.dev';
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/rotate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrAddress: email })
      });
      const data = await res.json();
      if (data.success && data.apiKey) {
        setApiKey(data.apiKey);
        localStorage.setItem(`ar_apikey_${email}`, data.apiKey);
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] API Key successfully rotated. Placed new active token in local storage.`]);
      }
    } catch (e) {
      console.error("Failed to rotate API Key:", e);
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [Error] API Key rotation failed.`]);
    }
  };

  // Renders the CLI login connection view if redirection is caught
  if (cliToken) {
    return (
      <div className="landing-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <BackgroundBackdrop />
        <section className="glass-panel" style={{ padding: '40px', maxWidth: '500px', textAlign: 'center', width: '100%' }}>
          <span style={{ fontSize: '24px', display: 'block', marginBottom: '20px', fontWeight: 'bold', color: 'var(--accent-blue)' }}>KEY</span>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '12px' }}>Authorize CLI Client</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '24px' }}>
            An external command-line terminal is requesting permission to authenticate as your account.
          </p>

          {!cliAuthorized ? (
            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-slate)', marginBottom: '24px' }}>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Session Token:</span>
                <code style={{ fontSize: '12px', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>{cliToken}</code>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Authorize As:</span>
                {isLoggedIn ? (
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>
                    {username ? (
                      `@${username}`
                    ) : walletAddress ? (
                      `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    ) : (
                      userEmail
                    )}
                  </span>
                ) : (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Please connect your Sui wallet to authorize this login connection:
                    </span>
                    <ConnectButton />
                  </div>
                )}
              </div>
              {isLoggedIn && (
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Active API Key:</span>
                  <code style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{apiKey.slice(0, 12)}...</code>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.875rem' }}>
              Authorization successful! You can now close this browser tab and return to your terminal.
            </div>
          )}

          {cliAuthError && (
            <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.875rem' }}>
              {cliAuthError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!cliAuthorized ? (
              <>
                <button 
                  onClick={handleAuthorizeCli} 
                  className="cta-button" 
                  style={{ width: '100%', justifyContent: 'center' }} 
                  disabled={!isLoggedIn}
                >
                  Confirm Login Connection
                </button>
                <button onClick={() => setCliToken(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setCliToken(null)} className="cta-button" style={{ width: '100%', justifyContent: 'center' }}>
                Go to Dashboard
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="landing-container">
        <BackgroundBackdrop />

        {/* Global Navbar */}
        <header className="navbar">
          <div 
            className="logo-container" 
            onClick={() => { window.location.hash = '#/'; }} 
            style={{ cursor: 'pointer' }}
          >
            AgentRelay
          </div>
          <div className="navbar-links">
            <button 
              className={`navbar-link ${landingTab === 'home' ? 'active' : ''}`}
              onClick={() => { window.location.hash = '#/'; }}
            >
              Home
            </button>
            <button 
              className={`navbar-link ${landingTab === 'docs' ? 'active' : ''}`}
              onClick={() => { window.location.hash = '#/docs'; }}
            >
              Docs
            </button>
            <button 
              onClick={() => setShowLoginModal(true)} 
              className="cta-button" 
              style={{ padding: '8px 16px', fontSize: '1.0rem' }}
            >
              Login
            </button>
          </div>
        </header>

        {landingTab === 'home' ? (
          <>
            {/* Renders the hero and details sections explaining agent memory */}
            <section className="hero-section">
              <ScrollReveal>
                <div className="hero-tagline" style={{ color: 'var(--accent-green-light)' }}>Sovereign Intelligence Protocol</div>
                <h1 className="hero-title">Decentralized Persistent Memory<br />for Autonomous AI Agents</h1>
                <p className="hero-subtitle">
                  Persist, transfer, and inherit memory state across sessions and LLM providers. Stored securely on Walrus Testnet and mapped on the Sui blockchain.
                </p>
              </ScrollReveal>
            </section>

            {/* Detailed technical concepts and solutions section */}
            <section style={{ margin: '80px 0', padding: '40px 0', borderTop: '1px solid var(--border-slate)', borderBottom: '1px solid var(--border-slate)' }}>
              <ScrollReveal>
                <h2 style={{ fontSize: '2.6rem', marginBottom: '24px', textAlign: 'center', fontWeight: 700, letterSpacing: '-0.03em' }}>The Core Memory Limitations of AI</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem', lineHeight: '1.7', maxWidth: '900px', margin: '0 auto 48px auto', textAlign: 'center' }}>
                  Modern artificial intelligence is stateless by design. Large language models and autonomous agent loops execute inside clean environments with no memory of past runs. To persist context across operations, developers face severe system bottlenecks.
                </p>
              </ScrollReveal>
              
              {/* Detailed list of issues and problems of AI */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '60px' }}>
                <ScrollReveal>
                  <div className="glass-panel" style={{ padding: '36px', height: '100%' }}>
                    <h3 style={{ fontSize: '1.45rem', marginBottom: '12px', fontWeight: 600, color: 'var(--accent-green-light)' }}>Statelessness & Session Amnesia</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.6' }}>
                      When an agent completes a task, the runtime environment is deleted, causing absolute session amnesia. The agent cannot naturally store episodic logs, newly acquired semantic facts, or procedural learnings. Starting the next run requires re-evaluating the objectives from scratch.
                    </p>
                  </div>
                </ScrollReveal>

                <ScrollReveal>
                  <div className="glass-panel" style={{ padding: '36px', height: '100%' }}>
                    <h3 style={{ fontSize: '1.45rem', marginBottom: '12px', fontWeight: 600, color: 'var(--accent-green-light)' }}>Context Window Saturation</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.6' }}>
                      Feeding full interaction transcripts and debug outputs back into the prompt window causes prompt bloat. This exhausts context window limits, introduces severe latency, degrades instruction recall, and generates high token costs.
                    </p>
                  </div>
                </ScrollReveal>
              </div>

              <ScrollReveal>
                <h2 style={{ fontSize: '2.6rem', marginBottom: '24px', textAlign: 'center', fontWeight: 700, letterSpacing: '-0.03em' }}>How AgentRelay Solves AI Amnesia</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem', lineHeight: '1.7', maxWidth: '900px', margin: '0 auto 48px auto', textAlign: 'center' }}>
                  AgentRelay decouples the agent's execution loop from its memory, storing a structured memory file on decentralized infrastructure.
                </p>
              </ScrollReveal>

              {/* Solutions architecture layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <ScrollReveal>
                  <div className="glass-panel" style={{ padding: '36px', height: '100%' }}>
                    <h3 style={{ fontSize: '1.45rem', marginBottom: '12px', fontWeight: 600, color: 'var(--accent-green-light)' }}>Decentralized Memory List</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.6' }}>
                      AgentRelay maps memory into distinct directories: logs timeline, facts, and tools. The compiled memory files are archived to Walrus decentralized storage as secure, high-availability blobs.
                    </p>
                  </div>
                </ScrollReveal>

                <ScrollReveal>
                  <div className="glass-panel" style={{ padding: '36px', height: '100%' }}>
                    <h3 style={{ fontSize: '1.45rem', marginBottom: '12px', fontWeight: 600, color: 'var(--accent-green-light)' }}>On-Chain State Synchronization</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.6' }}>
                      Verification hashes and blob IDs are synchronized on the Sui ledger. This builds a verifiable timeline of the agent's memory history, preventing session state race conditions and verifying integrity.
                    </p>
                  </div>
                </ScrollReveal>
              </div>
            </section>

            {/* Feature Timeline Section */}
            <section className="feature-timeline">
              <ScrollReveal className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content glass-panel">
                  <div className="timeline-step">Module 01</div>
                  <h3 className="timeline-title">Project Context & Mission Inherit</h3>
                  <p className="timeline-desc">
                    Establishes the permanent objective coordinates of your project. When new sub-agents are spawned, they inherit the parent mission and success metrics instantly, maintaining operational alignment.
                  </p>
                </div>
                <div></div>
              </ScrollReveal>

              <ScrollReveal className="timeline-item">
                <div className="timeline-dot"></div>
                <div></div>
                <div className="timeline-content glass-panel">
                  <div className="timeline-step">Module 02</div>
                  <h3 className="timeline-title">State Branching (Forking)</h3>
                  <p className="timeline-desc">
                    Allows agents to delegate sub-tasks by branching their state memory files. By calling the fork protocol, child agent instances inherit parent memory nodes without duplicating raw physical storage bytes.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content glass-panel">
                  <div className="timeline-step">Module 03</div>
                  <h3 className="timeline-title">Zero-SDK REST API Integrations</h3>
                  <p className="timeline-desc">
                    Enable persistent memory in any programming language. Interact with the memory stream using standard REST endpoints, eliminating local library installation overhead in restricted sandbox environments.
                  </p>
                </div>
                <div></div>
              </ScrollReveal>
            </section>
          </>
        ) : null}

        {/* Core Documentation workspace section */}
        {landingTab === 'docs' && (
          <section style={{ margin: '40px 0', paddingTop: '0' }}>
            <ScrollReveal>
              <h2 style={{ fontSize: '2.6rem', marginBottom: '12px', textAlign: 'center', fontWeight: 700, letterSpacing: '-0.03em' }}>Developer Documentation</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem', lineHeight: '1.7', maxWidth: '800px', margin: '0 auto 48px auto', textAlign: 'center' }}>
                Deep dive into the decentralized persistent memory schemas, smart contracts, SDK specifications, and token economics.
              </p>
            </ScrollReveal>

            <DocumentationViewer activeDocId={activeDocId} setActiveDocId={setActiveDocId} />
          </section>
        )}

        {/* Renders the popup modal for wallet authentication */}
        {showLoginModal && (
          <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
            <div className="modal-content glass-panel animate-fade-up" onClick={(e) => e.stopPropagation()} style={{ padding: '36px', maxWidth: '420px', position: 'relative' }}>
              <button 
                onClick={() => setShowLoginModal(false)} 
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  fontWeight: 'bold'
                }}
              >
                X
              </button>
              
              <h2 className="login-title" style={{ textAlign: 'center', marginBottom: '12px' }}>Access Your Workspace</h2>
              <p className="login-desc" style={{ textAlign: 'center', marginBottom: '24px' }}>Connect your Sui wallet or sign in using a developer profile to get started.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ConnectButton />
                </div>
                
                {/* Dev Sandbox Login Option */}
                <div style={{ borderTop: '1px solid var(--border-slate)', paddingTop: '16px', marginTop: '8px', textAlign: 'center' }}>
                  <button 
                    onClick={() => {
                      const mockAddress = '0x735700000000000000000000000000000000dfec';
                      setWalletAddress(mockAddress);
                      setUserEmail('test_dev@agentrelay.dev');
                      setIsLoggedIn(true);
                      checkUserProfile(mockAddress);
                      setShowLoginModal(false);
                    }}
                    className="connect-wallet-btn"
                    style={{ width: '100%', background: 'rgba(52, 211, 153, 0.15)', color: 'var(--accent-green-light)', border: '1px solid var(--accent-green-light)' }}
                  >
                    Sign in with Dev Profile (Local Sandbox)
                  </button>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-slate)', paddingTop: '16px', marginTop: '8px', textAlign: 'center' }}>
                  <span className="coming-soon-badge" style={{ display: 'inline-block', marginBottom: '8px' }}>Coming Soon</span>
                  <button className="connect-google-btn" style={{ width: '100%' }} disabled>
                    <span>Sign in with Google</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  // State 2: Rendering Onboarding Flow if user lacks a username
  if (showOnboarding) {
    return (
      <div className="onboarding-container">
        <BackgroundBackdrop />
        <div className="onboarding-card glass-panel animate-fade-up">
          <h2 style={{ fontSize: '1.75rem', marginBottom: '24px' }}>Claim Your Username</h2>

          <form onSubmit={handleClaimUsername}>
            <div className="username-input-wrapper">
              <input
                type="text"
                className="username-input"
                placeholder="developer_name"
                value={onboardingUsername}
                onChange={(e) => setOnboardingUsername(e.target.value)}
                autoFocus
              />
            </div>

            {onboardingError && (
              <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.875rem' }}>
                {onboardingError}
              </div>
            )}

            <button type="submit" className="cta-button" style={{ width: '100%', justifyContent: 'center' }}>
              Register Name & Proceed
            </button>
          </form>
        </div>
      </div>
    );
  }

  // State 3: Rendering Unified Dashboard State
  return (
    <div className="dashboard-grid">
      <BackgroundBackdrop />
      
      {/* Dashboard Left Sidebar */}
      <aside className="sidebar">
        <div className="logo-container" style={{ fontSize: '1.6rem' }}>
          AgentRelay
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-slate)' }}>
          <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Developer</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-green-light)' }}>@{username}</span>
        </div>

        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'swarm' ? 'active' : ''}`}
            onClick={() => setActiveTab('swarm')}
          >
            Agent Memory Dashboard
          </div>
          <div 
            className={`nav-item ${activeTab === 'market' ? 'active' : ''}`}
            onClick={() => setActiveTab('market')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <img src="/marketplace-logo.png" alt="Marketplace" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            Marketplace
          </div>
          <div 
            className={`nav-item ${activeTab === 'auth' ? 'active' : ''}`}
            onClick={() => setActiveTab('auth')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <img src="/settings-logo.png" alt="Settings" style={{ width: '16px', height: '16px', objectFit: 'contain', filter: 'invert(1)' }} />
            Dev Settings
          </div>
          <div 
            className={`nav-item ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => setActiveTab('docs')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '1.25rem', width: '16px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-secondary)' }}>D</span>
            Documentation
          </div>
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {userEmail === 'test_dev@agentrelay.dev' ? (
            <button 
              onClick={() => {
                setIsLoggedIn(false);
                setWalletAddress(null);
                setUserEmail(null);
                setUsername(null);
                setShowOnboarding(false);
              }}
              className="connect-wallet-btn"
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', width: '100%' }}
            >
              Disconnect Dev Profile
            </button>
          ) : (
            <ConnectButton />
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="main-content">
        
        {/* Swarm Workspace Tab */}
        {activeTab === 'swarm' && (
          <div>
            {/* Header section with toggle button for fork modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '3.2rem', marginBottom: '8px' }}>Agent Memory Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem' }}>Manage, inspect, and copy agent memories saved on the blockchain.</p>
              </div>
              <button 
                onClick={() => {
                  const activeAgentRecord = agents.find(a => (a.name || a.agentId) === selectedAgentId);
                  const activeBlobId = activeAgentRecord ? (activeAgentRecord.current_blob_id || activeAgentRecord.currentBlobId) : '';
                  setParentAgentId(activeBlobId || '');
                  setForkError(null);
                  setShowForkSection(true);
                }}
                className="cta-button"
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '1.0rem'
                }}
              >
                Fork Memory
              </button>
            </div>

            {/* Collapsible memory fork options popup modal */}
            {showForkSection && (
              <div className="modal-overlay" onClick={() => setShowForkSection(false)}>
                <div className="modal-content glass-panel animate-fade-up" onClick={(e) => e.stopPropagation()} style={{ padding: '36px', maxWidth: '500px', position: 'relative', width: '100%' }}>
                  <button 
                    onClick={() => setShowForkSection(false)} 
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      fontWeight: 'bold'
                    }}
                  >
                    X
                  </button>
                  
                  <h3 style={{ fontSize: '1.75rem', color: 'var(--accent-green-light)', marginBottom: '16px', textAlign: 'center' }}>Copy Memory (Fork)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', textAlign: 'center' }}>
                    Create a new memory branch linked to a parent memory history.
                  </p>

                  {forkError && (
                    <div style={{ 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid rgba(239, 68, 68, 0.3)', 
                      color: '#ef4444', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      marginBottom: '16px', 
                      fontSize: '0.85rem',
                      textAlign: 'left'
                    }}>
                      {forkError}
                    </div>
                  )}
                  
                  <form onSubmit={async (e) => {
                    const success = await triggerFork(e);
                    if (success) {
                      setShowForkSection(false);
                    }
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>New Memory Name</label>
                      <input 
                        type="text" 
                        className="username-input" 
                        placeholder="new_memory_name"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        style={{ padding: '12px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Parent Blob ID</label>
                      <input 
                        type="text" 
                        className="username-input" 
                        placeholder="walrus-blob-id-to-fork"
                        value={parentAgentId}
                        onChange={(e) => setParentAgentId(e.target.value)}
                        style={{ padding: '12px', width: '100%' }}
                      />
                    </div>
                    <button type="submit" className="cta-button" style={{ height: '46px', justifyContent: 'center', width: '100%', marginTop: '12px' }}>
                      Create Copy (Fork)
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Committed Agent Memory catalog grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              {agents.map((agent) => {
                const isSelected = selectedAgentId === (agent.name || agent.agentId);
                const blobId = agent.current_blob_id || agent.currentBlobId || '';
                const memoryId = agent.id || agent.agentId || '';
                const historyCount = agent.history ? agent.history.length : 1;
                const commitTime = agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'Recent';
                return (
                  <div 
                    key={agent.id || agent.agentId} 
                    className={`agent-card glass-panel ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedAgentId(agent.name || agent.agentId)}
                    style={{ 
                      padding: '20px', 
                      cursor: 'pointer', 
                      border: isSelected ? '1px solid var(--accent-green-light)' : '1px solid var(--border-slate)',
                      background: isSelected ? 'rgba(52, 211, 153, 0.03)' : 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: 'auto',
                      minHeight: '170px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="agent-name" style={{ color: isSelected ? 'var(--accent-green-light)' : '#fff', fontSize: '1.25rem', fontWeight: 700 }}>
                          {agent.name || agent.agentId}
                        </span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '3px 8px', 
                            background: agent.visibility === 'pb' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                            color: agent.visibility === 'pb' ? 'var(--accent-green-light)' : 'var(--text-secondary)',
                            borderRadius: '99px',
                            fontWeight: 600
                          }}>
                            {agent.visibility === 'pb' ? 'Public' : 'Private'}
                          </span>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '3px 8px', 
                            background: isSelected ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.05)', 
                            color: isSelected ? 'var(--accent-green-light)' : 'var(--text-secondary)',
                            borderRadius: '99px',
                            fontWeight: 600
                          }}>
                            v{agent.version || '1.0.0'}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Memory ID:</span>
                          <code style={{ fontSize: '0.75rem', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{memoryId}</code>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(memoryId);
                              setCopiedAgentId(agent.name || agent.agentId);
                              setTimeout(() => setCopiedAgentId(null), 2000);
                            }}
                            className="market-btn"
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-slate)',
                              color: copiedAgentId === (agent.name || agent.agentId) ? 'var(--accent-green-light)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              transition: 'color 0.2s ease'
                            }}
                            title="Copy Memory ID"
                          >
                            {copiedAgentId === (agent.name || agent.agentId) ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Blob ID:</span>
                          <code style={{ fontSize: '0.75rem', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{blobId}</code>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(blobId);
                              setCopiedBlobAgentId(agent.name || agent.agentId);
                              setTimeout(() => setCopiedBlobAgentId(null), 2000);
                            }}
                            className="market-btn"
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-slate)',
                              color: copiedBlobAgentId === (agent.name || agent.agentId) ? 'var(--accent-green-light)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              transition: 'color 0.2s ease'
                            }}
                            title="Copy Blob ID"
                          >
                            {copiedBlobAgentId === (agent.name || agent.agentId) ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span>{historyCount} {historyCount === 1 ? 'commit' : 'commits'}</span>
                          <span>{commitTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Memory File Inspector */}
            <div className="glass-panel" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column', marginBottom: '32px' }}>
              <div className="debugger-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-slate)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--accent-green-light)', fontWeight: 700 }}>Memory File Inspector</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                    Active Selected: <strong style={{ color: '#fff' }}>{selectedAgentId || 'None'}</strong>
                  </p>
                </div>
              </div>

              <div className="debugger-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-slate)', background: 'rgba(0,0,0,0.1)' }}>
                <button className={`debugger-tab ${activeCognitiveTab === 'project' ? 'active' : ''}`} onClick={() => setActiveCognitiveTab('project')} style={{ padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeCognitiveTab === 'project' ? '2px solid var(--accent-green-light)' : 'none', color: activeCognitiveTab === 'project' ? 'var(--accent-green-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>Project</button>
                <button className={`debugger-tab ${activeCognitiveTab === 'state' ? 'active' : ''}`} onClick={() => setActiveCognitiveTab('state')} style={{ padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeCognitiveTab === 'state' ? '2px solid var(--accent-green-light)' : 'none', color: activeCognitiveTab === 'state' ? 'var(--accent-green-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>State</button>
                <button className={`debugger-tab ${activeCognitiveTab === 'semantic' ? 'active' : ''}`} onClick={() => setActiveCognitiveTab('semantic')} style={{ padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeCognitiveTab === 'semantic' ? '2px solid var(--accent-green-light)' : 'none', color: activeCognitiveTab === 'semantic' ? 'var(--accent-green-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>Facts</button>
                <button className={`debugger-tab ${activeCognitiveTab === 'procedural' ? 'active' : ''}`} onClick={() => setActiveCognitiveTab('procedural')} style={{ padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeCognitiveTab === 'procedural' ? '2px solid var(--accent-green-light)' : 'none', color: activeCognitiveTab === 'procedural' ? 'var(--accent-green-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>Tools</button>
                <button className={`debugger-tab ${activeCognitiveTab === 'episodic' ? 'active' : ''}`} onClick={() => setActiveCognitiveTab('episodic')} style={{ padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeCognitiveTab === 'episodic' ? '2px solid var(--accent-green-light)' : 'none', color: activeCognitiveTab === 'episodic' ? 'var(--accent-green-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>Logs</button>
                <button className={`debugger-tab ${activeCognitiveTab === 'graph' ? 'active' : ''}`} onClick={() => setActiveCognitiveTab('graph')} style={{ padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeCognitiveTab === 'graph' ? '2px solid var(--accent-green-light)' : 'none', color: activeCognitiveTab === 'graph' ? 'var(--accent-green-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>Map</button>
              </div>

              <div className="debugger-body" style={{ flex: 1, padding: '24px' }}>
                {isNodeCrashed ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-danger)' }}>
                    <h4 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Sync Connection Timed Out</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Crash recovery active. Restoring memory files from Walrus Aggregator...</p>
                  </div>
                ) : isLoadingState ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>Restoring memory files...</div>
                ) : selectedAgentState ? (
                  <div className="code-block-wrapper">
                    {activeCognitiveTab === 'project' && (
                      <pre>{JSON.stringify(selectedAgentState.project_context || { message: "No context defined." }, null, 2)}</pre>
                    )}
                    {activeCognitiveTab === 'state' && (
                      <pre>{JSON.stringify(selectedAgentState.state || [], null, 2)}</pre>
                    )}
                    {activeCognitiveTab === 'semantic' && (
                      <pre>{JSON.stringify(selectedAgentState.semantic || [], null, 2)}</pre>
                    )}
                    {activeCognitiveTab === 'procedural' && (
                      <pre>{JSON.stringify(selectedAgentState.procedural || [], null, 2)}</pre>
                    )}
                    {activeCognitiveTab === 'episodic' && (
                      <pre>{JSON.stringify(selectedAgentState.episodic || [], null, 2)}</pre>
                    )}
                    {activeCognitiveTab === 'graph' && (
                      <pre>{JSON.stringify(selectedAgentState.graph || [], null, 2)}</pre>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>Select a memory from the list above to inspect it.</div>
                )}
              </div>
            </div>

            {/* SDK Log Stream Console */}
            <div className="glass-panel" style={{ marginTop: '32px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--accent-green-light)' }}>Protocol Log Stream</h3>
                <button onClick={() => setLogs([])} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.95rem' }}>Clear Console</button>
              </div>
              <div style={{ background: '#020306', borderRadius: '12px', border: '1px solid var(--border-slate)', padding: '16px', height: '180px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#10b981' }}>
                {logs.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: '6px' }}>{log}</div>
                ))}
                <div ref={logsEndRef}></div>
              </div>
            </div>
          </div>
        )}

        {/* Marketplace Workspace Tab */}
        {activeTab === 'market' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '3.2rem', marginBottom: '8px' }}>Memory Marketplace</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem' }}>Trade verified, structured memory files and skill logs.</p>
              </div>
              <button 
                onClick={() => setShowListMemorySection(true)}
                className="cta-button"
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '1.0rem'
                }}
              >
                List Memory
              </button>
            </div>

            {/* Collapsible list memory form popup modal */}
            {showListMemorySection && (
              <div className="modal-overlay" onClick={() => setShowListMemorySection(false)}>
                <div className="modal-content glass-panel animate-fade-up" onClick={(e) => e.stopPropagation()} style={{ padding: '36px', maxWidth: '500px', position: 'relative', width: '100%' }}>
                  <button 
                    onClick={() => setShowListMemorySection(false)} 
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      fontWeight: 'bold'
                    }}
                  >
                    X
                  </button>
                  
                  <h3 style={{ fontSize: '1.75rem', color: 'var(--accent-green-light)', marginBottom: '16px', textAlign: 'center' }}>List Memory</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', textAlign: 'center' }}>
                    Enter the details needed to list the memory package on the marketplace.
                  </p>
                  
                  <form onSubmit={(e) => {
                    triggerListMemory(e);
                    setShowListMemorySection(false);
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Package Title</label>
                      <input 
                        type="text" 
                        className="username-input" 
                        placeholder="My Trading Brain"
                        value={newPackTitle}
                        onChange={(e) => setNewPackTitle(e.target.value)}
                        style={{ padding: '12px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Memory Blob ID</label>
                      <input 
                        type="text" 
                        className="username-input" 
                        placeholder="walrus-blob-id"
                        value={newPackBlob}
                        onChange={(e) => setNewPackBlob(e.target.value)}
                        style={{ padding: '12px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Price (SUI)</label>
                      <input 
                        type="number" 
                        className="username-input" 
                        value={newPackPrice}
                        onChange={(e) => setNewPackPrice(Number(e.target.value))}
                        style={{ padding: '12px', width: '100%' }}
                      />
                    </div>
                    <button type="submit" className="cta-button" style={{ height: '46px', justifyContent: 'center', width: '100%', marginTop: '12px' }}>
                      List Memory
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="workspace-layout">
              {/* Left Side: Marketplace Grid */}
              <div className="market-grid" style={{ gridColumn: 'span 2' }}>
                {listings.map((list) => {
                  const isExpanded = !!expandedKeys[list.id];
                  const hasKey = !!purchasedKeys[list.id];
                  return (
                    <div key={list.id} className="glass-panel market-card">
                      <div className="market-header">
                        <h3 className="market-title">{list.title}</h3>
                        <div className="market-publisher">By @{resolveCreatorUsername(list.creator)}</div>
                      </div>
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
                        <span style={{ display: 'block', color: 'var(--text-muted)' }}>Parent Blob ID:</span>
                        {list.encryptedBlobId}
                      </div>

                      <div className="market-footer" style={{ flexDirection: hasKey ? 'column' : 'row', alignItems: hasKey ? 'stretch' : 'center' }}>
                        {hasKey ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.9rem', color: 'var(--accent-green-light)', fontWeight: 600 }}>Purchased</span>
                              <button
                                onClick={() => setExpandedKeys(prev => ({ ...prev, [list.id]: !prev[list.id] }))}
                                className="market-btn"
                                style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--border-slate)' }}
                              >
                                {isExpanded ? 'Hide Key' : 'Show Decryption Key'}
                              </button>
                            </div>
                            {isExpanded && (
                              <div style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid var(--border-slate)',
                                borderRadius: '8px',
                                padding: '10px',
                                marginTop: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px'
                              }}>
                                <code style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-secondary)',
                                  wordBreak: 'break-all',
                                  flex: 1
                                }}>
                                  {purchasedKeys[list.id]}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(purchasedKeys[list.id]);
                                    setCopiedKeyId(list.id);
                                    setTimeout(() => setCopiedKeyId(null), 2000);
                                  }}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-slate)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    color: copiedKeyId === list.id ? 'var(--accent-green-light)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {copiedKeyId === list.id ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="market-price">
                              {list.price} <span>SUI</span>
                            </div>
                            <button 
                              onClick={() => triggerPurchase(list.id, list.price)} 
                              className="market-btn"
                            >
                              Purchase & Hydrate
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Dev Settings Tab */}
        {activeTab === 'auth' && (
          <div style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ fontSize: '3.2rem', marginBottom: '8px' }}>Developer Settings</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem' }}>Manage authorization credentials and local SDK config links.</p>
            </div>

            <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '6px' }}>API Authorization Key</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>Used to run authenticated requests from local CLI terminals.</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <code style={{ flex: 1, padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-slate)', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>{apiKey}</code>
                  <button onClick={generateApiKey} className="market-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-slate)' }}>Rotate Key</button>
                </div>
                {apiKey.startsWith('••••') && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
                    Note: For security, API keys are write-only. If you do not have your plaintext token saved, click <strong>Rotate Key</strong> to generate a new active credential.
                  </p>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-slate)', paddingTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>SDK Setup Guide</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>Add this to your agent wrapper script to load the decentralized memory context.</p>
                <button 
                  onClick={handleCopyCode} 
                  className="connect-wallet-btn" 
                  style={{ width: 'auto', padding: '10px 20px', fontSize: '0.875rem', margin: '0 0 16px 0' }}
                >
                  {copyFeedback ? 'Copied Code!' : 'Copy SDK Code'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Docs Workspace Tab */}
        {activeTab === 'docs' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ fontSize: '3.2rem', marginBottom: '8px' }}>Developer Documentation</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.3rem' }}>Deep dive into persistent memory schemas, smart contracts, and SDK specifications.</p>
            </div>

            <DocumentationViewer activeDocId={activeDocId} setActiveDocId={setActiveDocId} />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
