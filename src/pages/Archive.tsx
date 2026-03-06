import React, { useEffect, useState } from 'react';
import { ArrowLeft, Database, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ArchiveRecord {
  uid: string;
  created_at: string;
  source_type: string;
  priority: string;
  domain: string;
  content_headline: string;
  content_summary: string;
  entities: string[];
}

const Archive: React.FC = () => {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    setLoading(true);
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
  }, [page]);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'text-sentinel-critical';
      case 'HIGH': return 'text-sentinel-high';
      case 'NORMAL': return 'text-sentinel-normal';
      default: return 'text-sentinel-blue';
    }
  };

  return (
    <div className="w-screen h-screen bg-sentinel-bg text-white font-mono overflow-y-auto">
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 p-4 px-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2 text-sentinel-blue">
            <Database size={20} />
            <h1 className="text-xl font-bold tracking-widest">INTELLIGENCE ARCHIVE</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-white/50">
          <span>{totalRecords.toLocaleString()} Total Records</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-8">
        
        {/* Search Bar (Client-side placeholder for now) */}
        <div className="mb-6 relative">
          <input 
            type="text" 
            placeholder="Search Historical Records..." 
            className="w-full bg-white/5 border border-white/10 text-white p-4 pl-12 rounded focus:outline-none focus:border-sentinel-blue transition-colors"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
        </div>

        {/* Data Table */}
        <div className="border border-white/10 rounded overflow-hidden bg-black/40">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-white/60">
              <tr>
                <th className="p-4 font-normal">TIME (UTC)</th>
                <th className="p-4 font-normal">PRIORITY</th>
                <th className="p-4 font-normal">DOMAIN</th>
                <th className="p-4 font-normal">HEADLINE</th>
                <th className="p-4 font-normal">SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sentinel-blue animate-pulse">
                    Querying Cold Storage...
                  </td>
                </tr>
              ) : records.map((record) => (
                <tr key={record.uid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 whitespace-nowrap text-white/70">
                    {new Date(record.created_at).toLocaleString()}
                  </td>
                  <td className={`p-4 font-bold ${getPriorityColor(record.priority)}`}>
                    {record.priority}
                  </td>
                  <td className="p-4 text-white/50">{record.domain}</td>
                  <td className="p-4 max-w-lg truncate" title={record.content_headline}>
                    {record.content_headline}
                  </td>
                  <td className="p-4 text-white/50">{record.source_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-4 text-sm">
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
  );
};

export default Archive;