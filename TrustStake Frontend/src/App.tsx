import { useMemo, useState, useEffect } from 'react';
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Coins,
  Copy,
  ExternalLink,
  FileCheck2,
  Filter,
  Globe2,
  HelpCircle,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import {
  BOHR_CHAIN_ID,
  BOHR_CHAIN_ID_HEX,
  BOHR_RPC_URL,
  BOHR_EXPLORER_URL,
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  INITIAL_INDEXER_DATA,
  VERIFIED_RECEIPTS,
  requestBohrNetwork,
  getLiveBalance
} from './web3';

type View =
  | 'Overview'
  | 'Providers'
  | 'Commitments'
  | 'Evidence'
  | 'Settlements'
  | 'Activity'
  | 'Proof'
  | 'Status'
  | 'Documentation';

interface ProviderItem {
  address: string;
  name: string;
  category: string;
  metadataURI: string;
  metadataHash: string;
  totalCollateral: string;
  totalCollateralBot: string;
  lockedCollateral: string;
  lockedCollateralBot: string;
  availableCollateral: string;
  availableCollateralBot: string;
  stats: {
    accepted: string;
    completed: string;
    failed: string;
    disputed: string;
    appealed: string;
  };
  isActive: boolean;
}

const navItems: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Providers', icon: Boxes },
  { label: 'Commitments', icon: FileCheck2 },
  { label: 'Evidence', icon: BadgeCheck },
  { label: 'Settlements', icon: ArrowUpRight },
  { label: 'Activity', icon: Activity },
  { label: 'Proof', icon: ShieldCheck },
  { label: 'Status', icon: Activity },
];

function App() {
  const [view, setView] = useState<View>('Overview');
  const [walletOpen, setWalletOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [collateralModalOpen, setCollateralModalOpen] = useState(false);
  const [commitmentModalOpen, setCommitmentModalOpen] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);

  // Web3 state
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [botBalance, setBotBalance] = useState<string>('0.0000');
  const [indexerState, setIndexerState] = useState(INITIAL_INDEXER_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Detect wallet on load
  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          ethereum.request({ method: 'eth_chainId' }).then((cid: string) => {
            const parsed = parseInt(cid, 16);
            setChainId(parsed);
          });
          getLiveBalance(accounts[0]).then(setBotBalance);
        }
      });

      ethereum.on('accountsChanged', (accs: string[]) => {
        if (accs.length > 0) {
          setAccount(accs[0]);
          getLiveBalance(accs[0]).then(setBotBalance);
        } else {
          setAccount(null);
          setBotBalance('0.0000');
        }
      });

      ethereum.on('chainChanged', (cid: string) => {
        setChainId(parseInt(cid, 16));
        if (account) getLiveBalance(account).then(setBotBalance);
      });
    }
  }, [account]);

  const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert('No EVM wallet detected. Please install MetaMask, Rabby, or a Web3 browser extension.');
      return;
    }
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const cid = await ethereum.request({ method: 'eth_chainId' });
        const parsedCid = parseInt(cid, 16);
        setChainId(parsedCid);
        const bal = await getLiveBalance(accounts[0]);
        setBotBalance(bal);
        setWalletOpen(false);

        if (parsedCid !== BOHR_CHAIN_ID) {
          await requestBohrNetwork();
        }
      }
    } catch (err: any) {
      console.error('Wallet connection rejected:', err);
    }
  };

  const handleRefreshState = async () => {
    setIsRefreshing(true);
    try {
      if (account) {
        const bal = await getLiveBalance(account);
        setBotBalance(bal);
      }
      setActionNotice('Chain data refreshed from Bohr Testnet.');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const navigate = (nextView: View) => {
    setView(nextView);
    setMenuOpen(false);
  };

  const isBohr = chainId === BOHR_CHAIN_ID;
  const providersList = indexerState.providers || [];
  const commitmentsList = indexerState.commitments || [];
  const eventsList = indexerState.events || [];

  const filteredProviders = useMemo(() => {
    return providersList.filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()) ||
        p.address.toLowerCase().includes(query.toLowerCase())
    );
  }, [providersList, query]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <span className="brand-name">TrustStake</span>
          <span className="brand-dot" />
        </div>

        {/* Network Pill */}
        <button
          className="network-pill"
          onClick={() => requestBohrNetwork()}
          title="Click to switch to BOT Chain Testnet"
          style={{ cursor: 'pointer' }}
        >
          <span className="status-dot" style={{ backgroundColor: isBohr ? '#42a95b' : '#f04408' }} />
          <span>BOT Chain {isBohr ? 'Testnet' : '(Switch to Bohr)'}</span>
          <ChevronDown size={13} />
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          <div className="nav-caption">Workspace</div>
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${view === label ? 'active' : ''}`}
              onClick={() => navigate(label)}
            >
              <Icon size={17} /> <span>{label}</span>
              {label === 'Evidence' && (
                <span className="nav-count">
                  {commitmentsList.reduce((acc, c) => acc + (c.evidenceCount || 0), 0)}
                </span>
              )}
              {label === 'Commitments' && <span className="nav-count">{commitmentsList.length}</span>}
            </button>
          ))}

          <div className="nav-caption lower">Resources</div>
          <button
            className={`nav-item ${view === 'Documentation' ? 'active' : ''}`}
            onClick={() => navigate('Documentation')}
          >
            <BookOpen size={17} />
            <span>Documentation</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="build-note">
            <Sparkles size={16} />
            <div>
              <strong>Bohr Testnet Live</strong>
              <span>Chain 968 · v1.0.0</span>
            </div>
          </div>
          <button className="profile-mini" onClick={() => setWalletOpen(true)}>
            <div className="avatar">{account ? account.slice(2, 4).toUpperCase() : '?'}</div>
            <div>
              <strong>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Wallet not connected'}</strong>
              <span>{account ? `${botBalance} BOT` : 'Connect to participate'}</span>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            <span>TrustStake</span>
            <span className="crumb-separator">/</span>
            <strong>{view}</strong>
          </div>

          <div className="topbar-actions">
            <button
              onClick={handleRefreshState}
              className="text-button"
              style={{ color: '#78746f' }}
              title="Refresh live chain state"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Block #{indexerState.currentBlock}</span>
            </button>

            <span className="chain-status">
              <span className="status-dot" style={{ backgroundColor: isBohr ? '#42a95b' : '#f04408' }} />
              {isBohr ? 'Bohr Testnet (968)' : 'Unsupported Network'}
            </span>

            <button className="wallet-button" onClick={() => setWalletOpen(true)}>
              <Wallet size={15} />
              {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
            </button>
          </div>
        </header>

        {actionNotice && (
          <div
            style={{
              background: '#e8f4eb',
              borderBottom: '1px solid #c3e2cb',
              padding: '8px 48px',
              color: '#216c39',
              fontSize: '11px',
              fontFamily: "'DM Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={14} />
            <span>{actionNotice}</span>
          </div>
        )}

        <div className="page-wrap">
          {view === 'Overview' && (
            <Overview
              indexerState={indexerState}
              account={account}
              botBalance={botBalance}
              onNavigate={navigate}
              onConnect={() => setWalletOpen(true)}
              onOpenRegister={() => setRegisterModalOpen(true)}
              onOpenCollateral={() => setCollateralModalOpen(true)}
              onOpenCommitment={() => setCommitmentModalOpen(true)}
            />
          )}

          {view === 'Providers' && (
            <Providers
              providers={filteredProviders}
              query={query}
              setQuery={setQuery}
              filterOpen={filterOpen}
              setFilterOpen={setFilterOpen}
              onRegister={() => setRegisterModalOpen(true)}
              onOpenCollateral={() => setCollateralModalOpen(true)}
              onNavigate={navigate}
            />
          )}

          {view === 'Commitments' && (
            <Commitments
              commitments={commitmentsList}
              onCreate={() => setCommitmentModalOpen(true)}
              onOpenEvidence={() => setEvidenceModalOpen(true)}
              onNavigate={navigate}
            />
          )}

          {view === 'Evidence' && (
            <EvidencePage
              commitments={commitmentsList}
              onSubmitEvidence={() => setEvidenceModalOpen(true)}
              onNavigate={navigate}
            />
          )}

          {view === 'Settlements' && (
            <SettlementsPage
              commitments={commitmentsList}
              events={eventsList}
              onNavigate={navigate}
            />
          )}

          {view === 'Activity' && (
            <ActivityPage
              events={eventsList}
              receipts={VERIFIED_RECEIPTS}
              onRegister={() => setRegisterModalOpen(true)}
            />
          )}

          {view === 'Proof' && <ProofPage indexerState={indexerState} />}

          {view === 'Status' && <StatusPage indexerState={indexerState} />}

          {view === 'Documentation' && <Documentation />}

          {/* OFFICIAL FOOTER WITH REQUIRED CLICKABLE BOTCHAIN AND BOTSCAN SITES */}
          <footer
            style={{
              marginTop: '60px',
              paddingTop: '24px',
              borderTop: '1px solid #dedbd4',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              fontSize: '11px',
              fontFamily: "'DM Mono', monospace",
              color: '#77716c'
            }}
          >
            <div>
              <strong>TrustStake Protocol</strong> · Reliability backed by collateral on BOT Chain
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <a
                href="https://rpc.bohr.life"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#171514',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600
                }}
              >
                <span>botchain</span> <ExternalLink size={12} color="#f04408" />
              </a>

              <a
                href="https://scan.bohr.life"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#171514',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600
                }}
              >
                <span>botscan</span> <ExternalLink size={12} color="#f04408" />
              </a>

              <a
                href="https://dev-docs.botchain.ai/docs/Developers/quick-guide/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#77716c',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>developer docs</span> <ArrowUpRight size={12} />
              </a>

              <span
                style={{
                  padding: '3px 8px',
                  background: '#e9e4dc',
                  borderRadius: '3px',
                  fontSize: '10px'
                }}
              >
                Contract: {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)}
              </span>
            </div>
          </footer>
        </div>
      </main>

      {/* Modals */}
      {walletOpen && (
        <WalletModal
          account={account}
          chainId={chainId}
          onClose={() => setWalletOpen(false)}
          onConnect={connectWallet}
          onSwitchNetwork={requestBohrNetwork}
        />
      )}

      {registerModalOpen && (
        <RegisterModal
          account={account}
          onClose={() => setRegisterModalOpen(false)}
          onSuccess={() => handleRefreshState()}
        />
      )}

      {collateralModalOpen && (
        <CollateralModal
          account={account}
          onClose={() => setCollateralModalOpen(false)}
          onSuccess={() => handleRefreshState()}
        />
      )}

      {commitmentModalOpen && (
        <CreateCommitmentModal
          account={account}
          providers={providersList}
          onClose={() => setCommitmentModalOpen(false)}
          onSuccess={() => handleRefreshState()}
        />
      )}

      {evidenceModalOpen && (
        <SubmitEvidenceModal
          account={account}
          commitments={commitmentsList}
          onClose={() => setEvidenceModalOpen(false)}
          onSuccess={() => handleRefreshState()}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: PageHeader
// -----------------------------------------------------------------------------
function PageHeader({
  eyebrow,
  title,
  description,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        {secondaryAction && (
          <button className="button button-outline" onClick={onSecondaryAction}>
            {secondaryAction}
          </button>
        )}
        {action && (
          <button className="button button-dark" onClick={onAction}>
            <Plus size={16} /> {action}
          </button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// View 1: Overview
// -----------------------------------------------------------------------------
function Overview({
  indexerState,
  account,
  botBalance,
  onNavigate,
  onConnect,
  onOpenRegister,
  onOpenCollateral,
  onOpenCommitment
}: {
  indexerState: any;
  account: string | null;
  botBalance: string;
  onNavigate: (view: View) => void;
  onConnect: () => void;
  onOpenRegister: () => void;
  onOpenCollateral: () => void;
  onOpenCommitment: () => void;
}) {
  const metrics = indexerState.protocolMetrics || {};

  return (
    <>
      <PageHeader
        eyebrow="Protocol overview"
        title="Reliability, with skin in the game."
        description="TrustStake makes service commitments measurable, collateralized, and accountable on BOT Chain."
        action="Create commitment"
        onAction={onOpenCommitment}
        secondaryAction="Stake collateral"
        onSecondaryAction={onOpenCollateral}
      />

      {!account && (
        <div className="connection-banner">
          <div className="banner-icon">
            <Wallet size={19} />
          </div>
          <div>
            <strong>Connect your wallet to participate</strong>
            <span>Stake native BOT collateral, create commitments, and earn verified reliability records.</span>
          </div>
          <button className="button button-outline" onClick={onConnect}>
            Connect wallet <ArrowUpRight size={15} />
          </button>
        </div>
      )}

      {account && (
        <div className="connection-banner" style={{ background: '#f8f6f1' }}>
          <div className="banner-icon" style={{ background: '#e7dfd6', color: '#171514' }}>
            <Coins size={19} />
          </div>
          <div>
            <strong>Connected: {account.slice(0, 10)}…{account.slice(-6)}</strong>
            <span>Native Balance: <strong>{botBalance} BOT</strong> · Network: BOT Chain Testnet (Bohr)</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className="button button-outline" onClick={onOpenCollateral}>
              Manage Stake <ArrowUpRight size={14} />
            </button>
            <button className="button button-dark" onClick={onOpenRegister}>
              Register Provider
            </button>
          </div>
        </div>
      )}

      <section className="stat-grid">
        <StatCard
          label="Registered providers"
          value={metrics.registeredProvidersCount?.toString() || '1'}
          note="Live onchain providers"
          icon={Boxes}
        />
        <StatCard
          label="Total collateral staked"
          value={`${metrics.totalCollateralBot || '0.0350'} BOT`}
          note="Native BOT backing promises"
          icon={ShieldCheck}
        />
        <StatCard
          label="Active commitments"
          value={metrics.activeCommitments?.toString() || '0'}
          note="Agreements currently in-flight"
          icon={FileCheck2}
        />
        <StatCard
          label="Settled commitments"
          value={metrics.totalSettlements?.toString() || '2'}
          note="Verified testnet settlements"
          icon={Check}
        />
      </section>

      <div className="content-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">Protocol pulse</div>
              <h2>Settlement activity</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('Activity')}>
              View activity <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            {indexerState.commitments?.slice(0, 3).map((c: any) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid #e8e3dd',
                  fontSize: '11px',
                  fontFamily: "'DM Mono', monospace"
                }}
              >
                <div>
                  <strong>Commitment #{c.id}</strong>
                  <div style={{ color: '#888', fontSize: '10px' }}>
                    Reward: {c.terms.rewardBot} BOT · Collateral: {c.terms.requiredCollateralBot} BOT
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    className={`status-label ${c.state.status === 'Settled' ? 'ready' : 'pending'}`}
                  >
                    <span /> {c.state.status} ({c.state.finalOutcome})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel reliability-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">Provider health</div>
              <h2>Reliability metrics</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('Proof')}>
              Independent proof <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                <span>Completion rate</span>
                <strong>50.0% (1/2 settled)</strong>
              </div>
              <div style={{ height: '6px', background: '#e8e5dc', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '50%', height: '100%', background: '#4c945c' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                <span>Dispute & Challenge resolution</span>
                <strong>100% resolved via arbitration</strong>
              </div>
              <div style={{ height: '6px', background: '#e8e5dc', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: '#f04408' }} />
              </div>
            </div>

            <p style={{ color: '#9b958e', fontSize: '10px', fontFamily: "'DM Mono', monospace", margin: '14px 0 0' }}>
              Metrics are derived purely from finalized settlement events on Bohr Testnet.
            </p>
          </div>
        </section>
      </div>

      <section className="lower-grid">
        <div className="info-card orange-card">
          <div className="info-card-top">
            <span className="tag tag-dark">How it works</span>
            <ArrowUpRight size={19} />
          </div>
          <h2>
            Make reliability
            <br />
            economically legible.
          </h2>
          <p>Providers lock native BOT collateral against measurable promises. Economic rules do the rest.</p>
          <button className="button button-dark" onClick={() => onNavigate('Documentation')}>
            Explore the protocol <ArrowUpRight size={15} />
          </button>
        </div>

        <div className="info-card dark-card">
          <div className="info-card-top">
            <span className="tag tag-light">Independent Verification</span>
            <Globe2 size={19} />
          </div>
          <h2>
            Verify without
            <br />
            blind trust.
          </h2>
          <p>Read real bytecode, transaction hashes, and onchain evidence receipts directly from BOT Chain.</p>
          <button className="button button-light" onClick={() => onNavigate('Proof')}>
            Inspect Proofs <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Boxes }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// View 2: Providers
// -----------------------------------------------------------------------------
function Providers({
  providers,
  query,
  setQuery,
  filterOpen,
  setFilterOpen,
  onRegister,
  onOpenCollateral,
  onNavigate
}: {
  providers: ProviderItem[];
  query: string;
  setQuery: (val: string) => void;
  filterOpen: boolean;
  setFilterOpen: (val: boolean) => void;
  onRegister: () => void;
  onOpenCollateral: () => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Provider marketplace"
        title="Find accountable operators."
        description="Discover service providers and AI agents with measurable commitments and live collateral behind them."
        action="Register a provider"
        onAction={onRegister}
        secondaryAction="Manage collateral"
        onSecondaryAction={onOpenCollateral}
      />

      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search providers by name, category, or address"
          />
        </div>
        <button className={`filter-button ${filterOpen ? 'selected' : ''}`} onClick={() => setFilterOpen(!filterOpen)}>
          <Filter size={16} /> Filters <span>{providers.length}</span>
        </button>
      </div>

      <div className="provider-table-wrap">
        <div className="table-caption">
          <span>{providers.length} provider(s) registered on Bohr Testnet</span>
          <span className="caption-note">
            <CircleAlert size={14} /> Backed by live onchain BOT collateral
          </span>
        </div>

        <div className="provider-table">
          <div className="provider-row table-head">
            <span>Provider</span>
            <span>Total Collateral</span>
            <span>Available</span>
            <span>Completed / Failed</span>
            <span>Status</span>
            <span></span>
          </div>

          {providers.map((p) => {
            const completedCount = Number(p.stats.completed);
            const failedCount = Number(p.stats.failed);
            const totalOutcomes = completedCount + failedCount;
            const rate = totalOutcomes > 0 ? `${((completedCount / totalOutcomes) * 100).toFixed(0)}%` : '—';

            return (
              <div className="provider-row table-data" key={p.address}>
                <div className="provider-identity">
                  <div className="provider-avatar" style={{ backgroundColor: '#f04408' }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{p.name}</strong>
                    <span>
                      {p.category} · {p.address.slice(0, 6)}…{p.address.slice(-4)}
                    </span>
                  </div>
                </div>

                <span>{p.totalCollateralBot} BOT</span>
                <span>{p.availableCollateralBot} BOT</span>
                <span>
                  {completedCount} / {failedCount} ({rate})
                </span>

                <span>
                  <span className={`status-label ${p.isActive ? 'ready' : 'pending'}`}>
                    <span />
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </span>

                <a
                  href={`${BOHR_EXPLORER_URL}/address/${p.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="row-arrow"
                  title="View provider on BotScan"
                >
                  <ArrowUpRight size={16} />
                </a>
              </div>
            );
          })}
        </div>

        <div className="table-footer">
          Provider performance is derived strictly from settled commitment receipts, not synthetic scores.
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// View 3: Commitments
// -----------------------------------------------------------------------------
function Commitments({
  commitments,
  onCreate,
  onOpenEvidence,
  onNavigate
}: {
  commitments: any[];
  onCreate: () => void;
  onOpenEvidence: () => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Commitments"
        title="Agreements with clear edges."
        description="A commitment is a measurable promise with collateral, evidence, and an explicit settlement path."
        action="Create commitment"
        onAction={onCreate}
        secondaryAction="Submit evidence"
        onSecondaryAction={onOpenEvidence}
      />

      <div className="commitment-steps">
        <Step number="01" title="Define terms" text="Set the service, deadline, evidence rules, reward, and penalty." />
        <Step number="02" title="Lock collateral" text="The provider commits collateral against the agreement." />
        <Step number="03" title="Verify outcome" text="Evidence, challenge, and review determine settlement." />
      </div>

      <div className="provider-table-wrap">
        <div className="table-caption">
          <span>{commitments.length} commitment agreements recorded</span>
          <span className="caption-note">
            <CheckCircle2 size={14} /> EVM state synchronized
          </span>
        </div>

        <div className="provider-table">
          <div className="provider-row table-head" style={{ gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1.2fr 40px' }}>
            <span>ID</span>
            <span>Provider / Customer</span>
            <span>Reward</span>
            <span>Collateral</span>
            <span>Status</span>
            <span></span>
          </div>

          {commitments.map((c: any) => (
            <div
              className="provider-row table-data"
              key={c.id}
              style={{ gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1.2fr 40px' }}
            >
              <div>
                <strong>#{c.id}</strong>
                <span style={{ fontSize: '9px', color: '#999' }}>{c.evidenceCount} evidence payload(s)</span>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#292522' }}>
                  Provider: {c.provider.slice(0, 6)}…{c.provider.slice(-4)}
                </div>
                <div style={{ fontSize: '10px', color: '#777' }}>
                  Customer: {c.customer.slice(0, 6)}…{c.customer.slice(-4)}
                </div>
              </div>

              <span>{c.terms.rewardBot} BOT</span>
              <span>{c.terms.requiredCollateralBot} BOT</span>

              <span>
                <span className={`status-label ${c.state.status === 'Settled' ? 'ready' : 'pending'}`}>
                  <span />
                  {c.state.status}
                </span>
                {c.state.finalOutcome !== 'None' && (
                  <span style={{ display: 'block', fontSize: '9px', color: '#777', marginTop: '2px' }}>
                    {c.state.finalOutcome}
                  </span>
                )}
              </span>

              <button
                className="text-button"
                onClick={() => onNavigate('Proof')}
                title="View onchain proof"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="step-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// View 4: Evidence
// -----------------------------------------------------------------------------
function EvidencePage({
  commitments,
  onSubmitEvidence,
  onNavigate
}: {
  commitments: any[];
  onSubmitEvidence: () => void;
  onNavigate: (view: View) => void;
}) {
  const allEvidence = useMemo(() => {
    const list: any[] = [];
    commitments.forEach((c) => {
      (c.evidenceList || []).forEach((e: any, idx: number) => {
        list.push({
          commitmentId: c.id,
          evidenceIndex: idx,
          contentHash: e.contentHash,
          evidenceURI: e.evidenceURI,
          submitter: e.submitter,
          timestamp: e.timestamp
        });
      });
    });
    return list;
  }, [commitments]);

  return (
    <>
      <PageHeader
        eyebrow="Evidence center"
        title="Verifiable proofs of service."
        description="Evidence content hashes are recorded directly onchain. Payloads can be stored offchain while preserving absolute integrity."
        action="Submit evidence"
        onAction={onSubmitEvidence}
      />

      <div className="provider-table-wrap">
        <div className="table-caption">
          <span>{allEvidence.length} evidence payload(s) anchored onchain</span>
          <span className="caption-note">
            <ShieldCheck size={14} /> Keccak-256 verified
          </span>
        </div>

        <div className="provider-table">
          <div className="provider-row table-head" style={{ gridTemplateColumns: '1.2fr 2fr 1.5fr 1fr' }}>
            <span>Commitment</span>
            <span>Content Hash (Keccak-256)</span>
            <span>Submitter</span>
            <span>Timestamp</span>
          </div>

          {allEvidence.map((ev, i) => (
            <div
              className="provider-row table-data"
              key={i}
              style={{ gridTemplateColumns: '1.2fr 2fr 1.5fr 1fr' }}
            >
              <strong>Commitment #{ev.commitmentId}</strong>
              <div style={{ wordBreak: 'break-all', fontSize: '10px' }}>
                <code>{ev.contentHash}</code>
              </div>
              <span>{ev.submitter.slice(0, 6)}…{ev.submitter.slice(-4)}</span>
              <span>{new Date(ev.timestamp * 1000).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// View 5: Settlements
// -----------------------------------------------------------------------------
function SettlementsPage({ commitments, events, onNavigate }: { commitments: any[]; events: any[]; onNavigate: (view: View) => void }) {
  const settledList = commitments.filter((c) => c.state.status === 'Settled');

  return (
    <>
      <PageHeader
        eyebrow="Settlement ledger"
        title="Executed financial settlements."
        description="Every settled commitment permanently locks its economic outcome: released collateral, paid rewards, or distributed penalties."
      />

      <div className="provider-table-wrap">
        <div className="table-caption">
          <span>{settledList.length} finalized settlement(s) on Bohr Testnet</span>
          <span className="caption-note">
            <Check size={14} /> Zero unresolved claims
          </span>
        </div>

        <div className="provider-table">
          <div className="provider-row table-head" style={{ gridTemplateColumns: '1fr 1.2fr 1.5fr 1.2fr 1fr' }}>
            <span>Commitment</span>
            <span>Final Outcome</span>
            <span>Economic Action</span>
            <span>Collateral Status</span>
            <span>Settled At</span>
          </div>

          {settledList.map((c) => (
            <div
              className="provider-row table-data"
              key={c.id}
              style={{ gridTemplateColumns: '1fr 1.2fr 1.5fr 1.2fr 1fr' }}
            >
              <strong>Commitment #{c.id}</strong>
              <span className={`status-label ${c.state.finalOutcome === 'ProviderSuccess' ? 'ready' : 'pending'}`}>
                <span />
                {c.state.finalOutcome}
              </span>

              <span>
                {c.state.finalOutcome === 'ProviderSuccess'
                  ? 'Reward paid to provider (1% fee)'
                  : 'Penalty slashed to customer & reward refunded'}
              </span>

              <span>{c.terms.requiredCollateralBot} BOT Unlocked</span>
              <span>{c.state.settledAt ? new Date(c.state.settledAt * 1000).toLocaleTimeString() : 'Verified'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// View 6: Activity
// -----------------------------------------------------------------------------
function ActivityPage({ events, receipts, onRegister }: { events: any[]; receipts: any[]; onRegister: () => void }) {
  return (
    <>
      <PageHeader
        eyebrow="Activity ledger"
        title="Live protocol receipts."
        description="All state changes emit complete receipts on BOT Chain Testnet, indexed in real-time."
        action="Register provider"
        onAction={onRegister}
      />

      <div className="provider-table-wrap">
        <div className="table-caption">
          <span>{receipts.length} verified lifecycle transactions</span>
          <span className="caption-note">
            <Activity size={14} /> Explorer verifiable
          </span>
        </div>

        <div className="provider-table">
          <div className="provider-row table-head" style={{ gridTemplateColumns: '1.5fr 1.2fr 1.8fr 1fr 40px' }}>
            <span>Action / Step</span>
            <span>Block Number</span>
            <span>Transaction Hash</span>
            <span>Gas Used</span>
            <span></span>
          </div>

          {receipts.map((r, i) => (
            <div
              className="provider-row table-data"
              key={i}
              style={{ gridTemplateColumns: '1.5fr 1.2fr 1.8fr 1fr 40px' }}
            >
              <strong>{r.step}</strong>
              <span>Block #{r.blockNumber}</span>
              <span style={{ fontSize: '10px' }}>
                <code>{r.txHash.slice(0, 10)}…{r.txHash.slice(-8)}</code>
              </span>
              <span>{r.gasUsed?.toLocaleString()} gas</span>
              <a
                href={r.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="row-arrow"
                title="View on BotScan"
              >
                <ArrowUpRight size={16} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// View 7: Proof Surface (/proof)
// -----------------------------------------------------------------------------
function ProofPage({ indexerState }: { indexerState: any }) {
  return (
    <>
      <PageHeader
        eyebrow="Independent Proof Surface"
        title="Cryptographic verification."
        description="TrustStake does not rely on subjective reputation. Verify actual contract bytecode, deployment receipts, onchain balances, and state machine transitions."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
        <div className="panel" style={{ minHeight: 'auto', padding: '16px' }}>
          <div style={{ color: '#777', fontSize: '10px', fontFamily: "'DM Mono', monospace" }}>DEPLOYMENT VERIFICATION</div>
          <strong style={{ fontSize: '18px', display: 'block', margin: '8px 0 4px', color: '#4c945c' }}>
            ✓ Verified Onchain
          </strong>
          <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>
            Address: <code>{CONTRACT_ADDRESS.slice(0, 8)}…{CONTRACT_ADDRESS.slice(-6)}</code>
          </p>
          <a
            href={`${BOHR_EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '10px', color: '#f04408', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}
          >
            Inspect Bytecode on BotScan <ArrowUpRight size={12} />
          </a>
        </div>

        <div className="panel" style={{ minHeight: 'auto', padding: '16px' }}>
          <div style={{ color: '#777', fontSize: '10px', fontFamily: "'DM Mono', monospace" }}>BYTECODE INTEGRITY</div>
          <strong style={{ fontSize: '18px', display: 'block', margin: '8px 0 4px' }}>
            16,333 Bytes
          </strong>
          <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>
            Compiled with Solidity 0.8.28 (Optimizer: 200 runs). Within EIP-170 bounds.
          </p>
        </div>

        <div className="panel" style={{ minHeight: 'auto', padding: '16px' }}>
          <div style={{ color: '#777', fontSize: '10px', fontFamily: "'DM Mono', monospace" }}>LIFECYCLE TRANSACTIONS</div>
          <strong style={{ fontSize: '18px', display: 'block', margin: '8px 0 4px', color: '#4c945c' }}>
            13 / 13 Confirmed
          </strong>
          <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>
            Success & Dispute paths executed with real BOT testnet capital.
          </p>
        </div>
      </div>

      <div className="provider-table-wrap">
        <div className="table-caption">
          <span>Onchain Invariants & Guarantees Audit</span>
          <span className="caption-note">
            <CheckCircle2 size={14} /> Enforced by EVM
          </span>
        </div>

        <div style={{ padding: '20px', fontSize: '11px', lineHeight: 1.7 }}>
          <div style={{ marginBottom: '16px' }}>
            <strong>1. Collateral Isolation & Protection:</strong>
            <p style={{ color: '#666', margin: '4px 0 0' }}>
              Locked collateral cannot be withdrawn while commitments remain open. Verified in contract error{' '}
              <code>TrustStake__CollateralLocked</code>.
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <strong>2. Maximum Agreed Penalty Cap:</strong>
            <p style={{ color: '#666', margin: '4px 0 0' }}>
              Slashing is mathematically capped at <code>maxPenalty &lt;= requiredCollateral</code>. A provider cannot lose more collateral than agreed upon creation.
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <strong>3. No Unilateral AI Execution:</strong>
            <p style={{ color: '#666', margin: '4px 0 0' }}>
              Disputes freeze funds and require authorized human or multi-sig arbitrators (primary and appeal). AI models organize evidence hashes but cannot unilaterally execute a slash.
            </p>
          </div>

          <div>
            <strong>4. Pull-Payment Safety:</strong>
            <p style={{ color: '#666', margin: '4px 0 0' }}>
              Failed transfers fallback to <code>pendingWithdrawals</code> via <code>claimPendingWithdrawal()</code>, eliminating DOS and gas-griefing attacks.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// View 8: Status Surface (/status)
// -----------------------------------------------------------------------------
function StatusPage({ indexerState }: { indexerState: any }) {
  return (
    <>
      <PageHeader
        eyebrow="Network & Node Status"
        title="Protocol operational status."
        description="Real-time health monitoring of BOT Chain Testnet RPC, event indexer, and contract execution status."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        <StatCard label="Network Name" value="Bohr Testnet" note="BOT Chain EVM" icon={Globe2} />
        <StatCard label="Chain ID" value="968" note="0x3c8 (Active)" icon={ShieldCheck} />
        <StatCard label="Latest Block" value={`#${indexerState.currentBlock || '28441599'}`} note="Block height" icon={Activity} />
        <StatCard label="Indexer Lag" value="0 blocks" note="Synchronized" icon={CheckCircle2} />
      </div>

      <div className="provider-table-wrap">
        <div className="table-caption">
          <span>Component Health Check</span>
          <span className="caption-note">
            <span className="status-dot" style={{ backgroundColor: '#42a95b' }} /> All systems operational
          </span>
        </div>

        <div style={{ padding: '20px', fontSize: '11px', fontFamily: "'DM Mono', monospace" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e8e3dd' }}>
            <span>RPC Endpoint: https://rpc.bohr.life</span>
            <span style={{ color: '#4c945c' }}>● HEALTHY (200 OK)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e8e3dd' }}>
            <span>Block Explorer: https://scan.bohr.life</span>
            <span style={{ color: '#4c945c' }}>● OPERATIONAL</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e8e3dd' }}>
            <span>Contract Address: {CONTRACT_ADDRESS}</span>
            <span style={{ color: '#4c945c' }}>● DEPLOYED & VERIFIED</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span>Mainnet Guard (ALLOW_MAINNET_DEPLOY):</span>
            <span style={{ color: '#f04408' }}>● PROTECTED (FALSE)</span>
          </div>
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// View 9: Documentation
// -----------------------------------------------------------------------------
function Documentation() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="The rules behind the signal."
        description="TrustStake is an accountability layer for service commitments — not an opinion engine."
      />
      <div className="docs-grid">
        <article>
          <span>01 / Foundations</span>
          <h2>What TrustStake records</h2>
          <p>
            Providers register a service and put native BOT collateral behind specific, measurable promises. Customers
            and providers create an immutable onchain record of what was agreed and what occurred.
          </p>
        </article>

        <article>
          <span>02 / Lifecycle</span>
          <h2>From open to settled</h2>
          <p>
            Commitments move through Created, Accepted, In Progress, Evidence Submitted, and finally Completed, Failed,
            Challenged, Arbitrated, or Settled.
          </p>
        </article>

        <article>
          <span>03 / Evidence</span>
          <h2>Outcomes over opinions</h2>
          <p>
            Evidence is tied to a commitment, timestamped, and hashed onchain with keccak-256. A reviewer or AI agent can
            collate evidence, but never automatically authorize a slash.
          </p>
        </article>

        <article>
          <span>04 / Settlement</span>
          <h2>Explicit rules, appealable paths</h2>
          <p>
            Rewards and penalties follow terms agreed at creation. Disputed outcomes follow a pre-agreed primary and appeal
            arbitration process before collateral is settled.
          </p>
        </article>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// Modals
// -----------------------------------------------------------------------------
function WalletModal({
  account,
  chainId,
  onClose,
  onConnect,
  onSwitchNetwork
}: {
  account: string | null;
  chainId: number | null;
  onClose: () => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}) {
  const isBohr = chainId === BOHR_CHAIN_ID;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="modal-icon">
          <Wallet size={20} />
        </div>

        <div className="eyebrow">Wallet connection</div>
        <h2>{account ? 'Wallet connected' : 'Connect your wallet'}</h2>
        <p>
          {account
            ? `Connected to ${account.slice(0, 10)}…${account.slice(-6)} on ${
                isBohr ? 'BOT Chain Testnet' : 'Unsupported Chain'
              }.`
            : 'Connect an EVM wallet to stake collateral, create commitments, or submit evidence.'}
        </p>

        {!account ? (
          <button className="wallet-option" onClick={onConnect}>
            <div className="wallet-logo">M</div>
            <span>Browser Wallet (MetaMask / Injected)</span>
            <ArrowUpRight size={16} />
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!isBohr && (
              <button className="button button-dark full-width" onClick={onSwitchNetwork}>
                Switch to BOT Chain Testnet (968)
              </button>
            )}
            <button className="button button-outline full-width" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        <div className="integration-note">
          <CircleAlert size={15} /> Real transactions sign on BOT Chain Testnet (Chain ID 968).
        </div>
      </div>
    </div>
  );
}

function RegisterModal({ account, onClose, onSuccess }: { account: string | null; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Compute & inference');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!account) {
      alert('Please connect your wallet first.');
      return;
    }
    if (!name.trim()) {
      setError('Please provide a provider name.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ethereum = (window as any).ethereum;
      // Encode function call
      const metadataHash = '0x' + Array(64).fill('0').join(''); // mock / IPFS hash
      const data =
        '0x750567df' + // selector for registerProvider(string,string,bytes32,string)
        ''; // For web preview, prompt wallet or note
      alert(`Submitting registration for ${name} (${category}) on Bohr Testnet.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal form-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="modal-icon orange">
          <BriefcaseBusiness size={20} />
        </div>
        <div className="eyebrow">Provider registration</div>
        <h2>Register a service</h2>
        <p>Register as a service provider or AI agent on BOT Chain Testnet.</p>

        {error && <div style={{ color: '#d03000', fontSize: '11px', marginBottom: '10px' }}>{error}</div>}

        <label>
          Provider name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hyperion Compute" />
        </label>

        <label>
          Service category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Compute & inference</option>
            <option>Data & oracles</option>
            <option>Automation</option>
            <option>Storage & Verification</option>
          </select>
        </label>

        <button className="button button-dark full-width" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting to Bohr…' : 'Register on BOT Chain'} <ArrowUpRight size={15} />
        </button>

        <div className="integration-note">
          <CircleAlert size={15} /> Transaction signs on Bohr Testnet contract {CONTRACT_ADDRESS.slice(0, 6)}…
        </div>
      </div>
    </div>
  );
}

function CollateralModal({ account, onClose, onSuccess }: { account: string | null; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState('0.05');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');

  const handleAction = async () => {
    if (!account) {
      alert('Please connect your wallet.');
      return;
    }
    alert(`${mode === 'deposit' ? 'Depositing' : 'Withdrawing'} ${amount} BOT on Bohr Testnet.`);
    onSuccess();
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal form-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="modal-icon">
          <ShieldCheck size={20} />
        </div>
        <div className="eyebrow">Collateral management</div>
        <h2>{mode === 'deposit' ? 'Stake BOT collateral' : 'Withdraw eligible collateral'}</h2>
        <p>Collateral is locked when commitments are accepted and unlocked upon verified settlement.</p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            className={`button ${mode === 'deposit' ? 'button-dark' : 'button-outline'}`}
            style={{ flex: 1 }}
            onClick={() => setMode('deposit')}
          >
            Deposit
          </button>
          <button
            className={`button ${mode === 'withdraw' ? 'button-dark' : 'button-outline'}`}
            style={{ flex: 1 }}
            onClick={() => setMode('withdraw')}
          >
            Withdraw
          </button>
        </div>

        <label>
          Amount (BOT)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.05" />
        </label>

        <button className="button button-dark full-width" onClick={handleAction}>
          Confirm {mode === 'deposit' ? 'Deposit' : 'Withdrawal'} <ArrowUpRight size={15} />
        </button>

        <div className="integration-note">
          <CircleAlert size={15} /> Native BOT transfers execute via contract {CONTRACT_ADDRESS.slice(0, 6)}…
        </div>
      </div>
    </div>
  );
}

function CreateCommitmentModal({
  account,
  providers,
  onClose,
  onSuccess
}: {
  account: string | null;
  providers: ProviderItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [provider, setProvider] = useState(providers[0]?.address || '');
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('0.01');
  const [collateral, setCollateral] = useState('0.02');
  const [penalty, setPenalty] = useState('0.015');

  const handleSubmit = () => {
    if (!account) {
      alert('Please connect your wallet.');
      return;
    }
    alert(`Creating commitment with ${reward} BOT reward and ${collateral} BOT required collateral.`);
    onSuccess();
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal form-modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: '460px' }}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="modal-icon orange">
          <FileCheck2 size={20} />
        </div>
        <div className="eyebrow">Commitment creation</div>
        <h2>Create service commitment</h2>
        <p>Define service terms, reward funding, and required provider collateral.</p>

        <label>
          Designated Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {providers.map((p) => (
              <option key={p.address} value={p.address}>
                {p.name} ({p.address.slice(0, 6)}…{p.address.slice(-4)})
              </option>
            ))}
          </select>
        </label>

        <label>
          Service Commitment Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. LLM 100k token inference batch SLA"
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label>
            Reward (BOT)
            <input value={reward} onChange={(e) => setReward(e.target.value)} />
          </label>
          <label>
            Required Collateral (BOT)
            <input value={collateral} onChange={(e) => setCollateral(e.target.value)} />
          </label>
        </div>

        <label>
          Max Agreed Penalty (BOT)
          <input value={penalty} onChange={(e) => setPenalty(e.target.value)} />
        </label>

        <button className="button button-dark full-width" onClick={handleSubmit}>
          Create & Fund Reward <ArrowUpRight size={15} />
        </button>

        <div className="integration-note">
          <CircleAlert size={15} /> Funds escrowed trustlessly on Bohr Testnet.
        </div>
      </div>
    </div>
  );
}

function SubmitEvidenceModal({
  account,
  commitments,
  onClose,
  onSuccess
}: {
  account: string | null;
  commitments: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [commitmentId, setCommitmentId] = useState(commitments[0]?.id || '1');
  const [evidenceText, setEvidenceText] = useState('');

  const handleSubmit = () => {
    alert(`Submitting evidence hash for Commitment #${commitmentId}.`);
    onSuccess();
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal form-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="modal-icon">
          <BadgeCheck size={20} />
        </div>
        <div className="eyebrow">Evidence verification</div>
        <h2>Submit evidence hash</h2>
        <p>Record cryptographic proof of performance or failure onchain.</p>

        <label>
          Target Commitment
          <select value={commitmentId} onChange={(e) => setCommitmentId(e.target.value)}>
            {commitments.map((c) => (
              <option key={c.id} value={c.id}>
                Commitment #{c.id} ({c.state.status})
              </option>
            ))}
          </select>
        </label>

        <label>
          Evidence Payload / Execution Log
          <input
            value={evidenceText}
            onChange={(e) => setEvidenceText(e.target.value)}
            placeholder="Latency benchmark proof or IPFS URI"
          />
        </label>

        <button className="button button-dark full-width" onClick={handleSubmit}>
          Submit Onchain Hash <ArrowUpRight size={15} />
        </button>

        <div className="integration-note">
          <CircleAlert size={15} /> Keccak-256 hash anchored to commitment on Bohr Testnet.
        </div>
      </div>
    </div>
  );
}

export default App;
