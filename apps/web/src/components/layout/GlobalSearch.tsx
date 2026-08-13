import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, User, Folder, CheckSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface SearchResult {
  employees: Array<{ id: string; firstName: string; lastName: string; code: string }>;
  projects: Array<{ id: string; name: string; status: string }>;
  tasks: Array<{ id: string; title: string; projectId: string; projectName: string }>;
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/dashboard/search', { params: { q: query } });
        setResults(res.data.data);
      } catch (e) {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative flex-1 max-w-md hidden sm:block group" ref={wrapperRef}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <Input 
        placeholder="Search employees, projects, tasks..." 
        className="pl-9 bg-muted/40 border-border/50 hover:bg-muted/60 focus-visible:bg-background transition-colors"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.length >= 2) setOpen(true);
        }}
      />

      {open && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {loading ? (
            <div className="p-4 flex justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : results ? (
            <div className="py-2">
              {results.employees.length === 0 && results.projects.length === 0 && results.tasks.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No results found for "{query}"
                </div>
              )}

              {results.employees.length > 0 && (
                <div className="px-3 py-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Employees</div>
                  {results.employees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => handleNavigate('/employees')}
                      className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-md flex items-center gap-2 text-sm transition-colors"
                    >
                      <User className="h-4 w-4 text-primary/70" />
                      <span>{emp.firstName} {emp.lastName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{emp.code}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.projects.length > 0 && (
                <div className="px-3 py-1 mt-2 border-t pt-2 border-border/50">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Projects</div>
                  {results.projects.map(proj => (
                    <button
                      key={proj.id}
                      onClick={() => handleNavigate('/projects')}
                      className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-md flex items-center gap-2 text-sm transition-colors"
                    >
                      <Folder className="h-4 w-4 text-primary/70" />
                      <span>{proj.name}</span>
                      <span className="text-[10px] uppercase bg-muted-foreground/10 text-muted-foreground px-1.5 py-0.5 rounded ml-auto">{proj.status}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.tasks.length > 0 && (
                <div className="px-3 py-1 mt-2 border-t pt-2 border-border/50">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tasks</div>
                  {results.tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleNavigate('/tasks')}
                      className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-md flex items-center gap-2 text-sm transition-colors"
                    >
                      <CheckSquare className="h-4 w-4 text-primary/70" />
                      <span className="truncate">{task.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{task.projectName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
