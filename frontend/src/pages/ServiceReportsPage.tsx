import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, Clock, User, Building2, CheckCircle2, Trash2 } from 'lucide-react';
import { useServiceReports, useDeleteServiceReport, useProjects } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';

export function ServiceReportsPage() {
  const { data: reports = [], isLoading } = useServiceReports();
  const { data: projects = [] } = useProjects();
  const deleteMut = useDeleteServiceReport();
  const { user } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('all');

  const filtered = reports.filter((r) => {
    const matchSearch =
      r.workPerformed.toLowerCase().includes(search.toLowerCase()) ||
      r.technician?.name.toLowerCase().includes(search.toLowerCase()) ||
      r.project?.title.toLowerCase().includes(search.toLowerCase());
    const matchProject = filterProject === 'all' || r.projectId === filterProject;
    return matchSearch && matchProject;
  });

  const totalHours = filtered.reduce((sum, r) => sum + Number(r.hoursLogged), 0);

  async function handleDelete(id: string) {
    if (!confirm('Delete this service report?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Report deleted' });
    } catch {
      toast({ title: 'Failed to delete report', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service Reports</h1>
          <p className="text-muted-foreground">
            {reports.length} reports · {totalHours.toFixed(1)} hours logged (filtered)
          </p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No reports found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {r.project && (
                        <Link to={`/projects/${r.project.id}`} className="text-sm font-semibold hover:text-blue-600 transition-colors">
                          {r.project.title}
                        </Link>
                      )}
                      {r.project?.customer && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {r.project.customer.companyName}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{r.workPerformed}</p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">{r.technician?.name ?? 'Unknown'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold text-foreground">{Number(r.hoursLogged).toFixed(1)}h</span>
                      </span>
                      <span>{formatDateTime(r.submittedAt)}</span>
                      {r.digitalSignature && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Signed: {r.digitalSignature}
                        </span>
                      )}
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
