import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, Clock, User, Building2, CheckCircle2, Trash2, Paperclip } from 'lucide-react';
import { useServiceReports, useDeleteServiceReport, useProjects, useMedia } from '@/hooks/useQueries';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { MediaGalleryDialog } from '@/components/ui/MediaGallery';
import { formatDateTime } from '@/lib/utils';
import { ServiceReport } from '@/types';

const WORK_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  SERVICE_ENGINEER: { label: 'Service / Installation', className: 'bg-blue-100 text-blue-700' },
  DESIGN_ENGINEER:  { label: 'Design / Engineering',   className: 'bg-purple-100 text-purple-700' },
  PROJECT_MANAGER:  { label: 'Project Management',     className: 'bg-green-100 text-green-700' },
};

function AttachmentCount({ reportId }: { reportId: string }) {
  const { data: files = [] } = useMedia('service_report', reportId);
  if (files.length === 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Paperclip className="w-3 h-3" />
      {files.length}
    </span>
  );
}

export function ServiceReportsPage() {
  const { data: reports = [], isLoading } = useServiceReports();
  const { data: projects = [] } = useProjects();
  const deleteMut = useDeleteServiceReport();
  const { user } = useAuth();
  const { toast } = useToast();

  const [search, setSearch]             = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterWorkType, setFilterWorkType] = useState('all');
  const [mediaTarget, setMediaTarget]   = useState<ServiceReport | null>(null);

  const filtered = reports.filter((r) => {
    const matchSearch =
      r.workPerformed.toLowerCase().includes(search.toLowerCase()) ||
      (r.technician?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.project?.title ?? '').toLowerCase().includes(search.toLowerCase());
    const matchProject  = filterProject  === 'all' || r.projectId === filterProject;
    const matchWorkType = filterWorkType === 'all' || r.workType === filterWorkType;
    return matchSearch && matchProject && matchWorkType;
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
          <SelectTrigger className="w-56"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterWorkType} onValueChange={setFilterWorkType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All work types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All work types</SelectItem>
            {Object.entries(WORK_TYPE_STYLES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
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
          {filtered.map((r) => {
            const wt = r.workType ? WORK_TYPE_STYLES[r.workType] : null;
            return (
              <Card key={r.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Project + customer header */}
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
                        {/* Work type badge */}
                        {wt && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${wt.className}`}>
                            {wt.label}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{r.workPerformed}</p>

                      {/* Meta row */}
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
                        <AttachmentCount reportId={r.id} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                        title="Attachments"
                        onClick={() => setMediaTarget(r)}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </Button>
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Attachments dialog */}
      {mediaTarget && (
        <MediaGalleryDialog
          open={!!mediaTarget}
          onClose={() => setMediaTarget(null)}
          title={mediaTarget.project?.title ?? 'Service Report'}
          description={`${mediaTarget.technician?.name ?? ''} · ${formatDateTime(mediaTarget.submittedAt)} — files stored in Customer / Service Reports on Google Drive`}
          entityType="service_report"
          entityId={mediaTarget.id}
        />
      )}
    </div>
  );
}
