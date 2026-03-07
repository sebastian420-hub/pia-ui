import React, { useEffect, useState } from 'react';
import { ArrowLeft, Database, Search, FolderSearch, Users, Activity, SlidersHorizontal, Network } from 'lucide-react';
import { Link } from 'react-router-dom';
import RelationalWeb from '../components/hud/RelationalWeb';

interface ArchiveRecord {
  uid: string;
  created_at: string | null;
  source_type: string;
  priority: string;
  domain: string;
  content_headline: string;
  content_summary: string;
  entities?: string[];
  similarity?: number; // From semantic search
}

const Archive: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'uir' | 'entities'>('uir');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeGraphEntity, setActiveGraphEntity] = useState<string | null>(null);
  
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Global Key Listener for ESC to close graph
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveGraphEntity(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch standard paginated data when not searching
  useEffect(() => {
    if (isSearching) return;

    setLoading(true);
    if (activeTab === 'uir') {
      fetch(`http://localhost:8001/api/v1/archive?page=${page}&limit=50`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setRecords(data.data);
            setTotalPages(data.pagination.total_pages);
            setTotalRecords(data.pagination.total);
          }
        })
        .catch(err => console.error("Failed to fetch archive:", err))
        .finally(() => setLoading(false));
    } else if (activeTab === 'entities') {
      fetch(`http://localhost:8001/api/v1/entities?page=${page}&limit=50`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setRecords(data.data);
            setTotalPages(data.pagination.total_pages);
            setTotalRecords(data.pagination.total);
          }
        })
        .catch(err => console.error("Failed to fetch entities:", err))
        .finally(() => setLoading(false));
    }
  }, [page, activeTab, isSearching]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:8001/api/v1/search/semantic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          target: activeTab,
          limit: 30
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setRecords(data.data);
        setTotalPages(1);
        setTotalRecords(data.data.length);
      }
    } catch (err) {
      console.error("Failed to search:", err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'text-sentinel-critical';
      case 'HIGH': return 'text-sentinel-high';
      case 'NORMAL': return 'text-sentinel-normal';
      default: return 'text-sentinel-blue';
    }
  };

  return (
    <div className="w-screen h-screen bg-sentinel-bg text-white font-mono flex flex-col overflow-hidden relative">
      
      {/* Header */}
      <div className="flex-none bg-black/80 backdrop-blur-md border-b border-white/10 p-4 px-8 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2 text-sentinel-blue">
            <Database size={20} />
            <h1 className="text-xl font-bold tracking-widest">OMNISCIENT ARCHIVE</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-white/50">
          <span>{totalRecords.toLocaleString()} {isSearching ? 'Search Results' : 'Total Records'}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-white/10 bg-black/50 p-4 flex flex-col gap-6 overflow-y-auto z-10">
          <div>
            <h2 className="text-xs text-white/40 font-bold mb-3 flex items-center gap-2">
              <FolderSearch size={14} /> MODE
            </h2>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => { setActiveTab('uir'); setPage(1); setIsSearching(false); setSearchQuery(''); }}
                className={`flex items-center gap-2 p-2 rounded text-sm transition-colors ${activeTab === 'uir' ? 'bg-sentinel-blue/20 text-sentinel-blue border border-sentinel-blue/30' : 'text-white/60 hover:bg-white/5'}`}
              >
                <Activity size={16} />
                Intelligence Vault
              </button>
              <button 
                onClick={() => { setActiveTab('entities'); setPage(1); setIsSearching(false); setSearchQuery(''); }}
                className={`flex items-center gap-2 p-2 rounded text-sm transition-colors ${activeTab === 'entities' ? 'bg-sentinel-blue/20 text-sentinel-blue border border-sentinel-blue/30' : 'text-white/60 hover:bg-white/5'}`}
              >
                <Users size={16} />
                Entity Directory
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-xs text-white/40 font-bold mb-3 flex items-center gap-2">
              <SlidersHorizontal size={14} /> FILTERS
            </h2>
            <div className="text-xs text-white/30 italic">
              Advanced filters (Date, Source, Domain) coming soon...
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-black/20 z-10">
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-6 relative flex-none">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'uir' ? "Semantic Search: 'Naval escalation in South China Sea'..." : "Search Entity Directory: 'Vladimir Putin', 'CIA'..."} 
              className="w-full bg-white/5 border border-white/10 text-white p-4 pl-12 pr-24 rounded focus:outline-none focus:border-sentinel-blue transition-colors"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
            {searchQuery && (
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-sentinel-blue/20 text-sentinel-blue px-4 py-1.5 rounded text-sm hover:bg-sentinel-blue/40 transition-colors border border-sentinel-blue/30"
              >
                SEARCH
              </button>
            )}
          </form>

          {/* Data Table */}
          <div className="flex-1 border border-white/10 rounded overflow-hidden bg-black/40 flex flex-col">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-sm relative">
                <thead className="bg-black/80 backdrop-blur sticky top-0 z-10 border-b border-white/10 text-white/60">
                  <tr>
                    {activeTab === 'uir' && <th className="p-4 font-normal whitespace-nowrap">TIME (UTC)</th>}
                    <th className="p-4 font-normal">PRIORITY</th>
                    <th className="p-4 font-normal">DOMAIN</th>
                    <th className="p-4 font-normal">HEADLINE</th>
                    <th className="p-4 font-normal">SOURCE</th>
                    {isSearching && <th className="p-4 font-normal">MATCH</th>}
                    {activeTab === 'entities' && <th className="p-4 font-normal">ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isSearching ? 6 : 5} className="p-8 text-center text-sentinel-blue animate-pulse">
                        {isSearching ? 'Vectorizing Query and Searching Storage...' : 'Querying Cold Storage...'}
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={isSearching ? 6 : 5} className="p-8 text-center text-white/50">
                        {activeTab === 'entities' && !isSearching 
                          ? 'No entities found in directory.' 
                          : 'No records found.'}
                      </td>
                    </tr>
                  ) : records.map((record, idx) => (
                    <tr key={record.uid || idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      {activeTab === 'uir' && (
                        <td className="p-4 whitespace-nowrap text-white/70">
                          {record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}
                        </td>
                      )}
                      <td className={`p-4 font-bold ${getPriorityColor(record.priority)}`}>
                        {record.priority}
                      </td>
                      <td className="p-4 text-white/50">{record.domain}</td>
                      <td className="p-4 max-w-lg">
                        <div className="truncate font-semibold text-white/90" title={record.content_headline}>
                          {record.content_headline}
                        </div>
                        {record.content_summary && (
                          <div className="text-xs text-white/40 truncate mt-1" title={record.content_summary}>
                            {record.content_summary}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-white/50 whitespace-nowrap">{record.source_type}</td>
                      {isSearching && (
                        <td className="p-4 text-sentinel-blue/80 whitespace-nowrap">
                          {record.similarity ? `${(record.similarity * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                      )}
                      {activeTab === 'entities' && (
                        <td className="p-4">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveGraphEntity(record.content_headline); }}
                            className="bg-sentinel-blue/20 p-2 rounded hover:bg-sentinel-blue/40 text-sentinel-blue transition-colors"
                            title="View Relational Network"
                          >
                            <Network size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {!loading && !isSearching && totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-4 text-sm flex-none">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 border border-white/20 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                PREV
              </button>
              <span className="text-white/50">
                PAGE {page} OF {totalPages}
              </span>
              <button 
                disabled={page === totalPages} 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 border border-white/20 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                NEXT
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Relational Web Overlay (Z-40) */}
      {activeGraphEntity && (
        <RelationalWeb 
          entityName={activeGraphEntity} 
          onClose={() => setActiveGraphEntity(null)} 
        />
      )}
    </div>
  );
};

export default Archive;
