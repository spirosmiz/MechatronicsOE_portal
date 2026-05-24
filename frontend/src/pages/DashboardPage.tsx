import { Link } from 'react-router-dom';
import {
  FolderOpen, Package, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, Wrench,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, STATUS_COLORS, STATUS_LABELS, JOB_TYPE_LABELS } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

const STATUS_CHART_COLORS = ['#6b7280', '#f59e0b', '#3b82f6', '#6366f1', '#22c55e', '#ef4444'];
const JOB_CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const { user } = useAuth();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  const byStatusData = stats?.byStatus.map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    count: s._count,
  })) ?? [];

  const byTypeData = stats?.byType.map((t) => ({
    name: JOB_TYPE_LABELS[t.type] ?? t.type,
    count: t._count,
  })) ?? [];

  const inProgressCount = stats?.byStatus.find((s) => s.status === 'in_progress')?._count ?? 0;
  const pendingCount = stats?.byStatus.find((s) => s.status === 'pending_approval')?._count ?? 0;
  const completedCount = stats?.byStatus.find((s) => s.status === 'completed')?._count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting()}, {user?.name.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's happening across your operations today.</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'project_manager') && (
          <Link to="/projects">
            <Button>
              <FolderOpen className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-bold mt-1">{stats?.total ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-3xl font-bold mt-1 text-indigo-600">{inProgressCount}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Wrench className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{pendingCount}</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{completedCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue + Low Stock row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total Quoted Value</CardTitle>
            <CardDescription>Cumulative value across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-blue-600">
              {stats?.totalValue ? formatCurrency(stats.totalValue) : '—'}
            </p>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Across {stats?.total} active and historical projects
            </p>
          </CardContent>
        </Card>

        <Card className={stats?.lowStockCount && stats.lowStockCount > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {stats?.lowStockCount && stats.lowStockCount > 0 && (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Parts below safety stock level</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${stats?.lowStockCount ? 'text-amber-600' : 'text-green-600'}`}>
              {stats?.lowStockCount ?? 0}
            </p>
            <Link to="/inventory?lowStock=true">
              <Button variant="link" size="sm" className="px-0 mt-2">
                <Package className="w-4 h-4 mr-1" />
                View inventory →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStatusData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Projects" radius={[4, 4, 0, 0]}>
                  {byStatusData.map((_entry, i) => (
                    <Cell key={i} fill={STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byTypeData}
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {byTypeData.map((_entry, i) => (
                    <Cell key={i} fill={JOB_CHART_COLORS[i % JOB_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent projects */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Projects</CardTitle>
          <Link to="/projects">
            <Button variant="ghost" size="sm">View all →</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {stats?.recentProjects.length === 0 && (
              <p className="py-8 text-center text-muted-foreground text-sm">No projects yet</p>
            )}
            {stats?.recentProjects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-sm">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.customer?.companyName} · {formatDate(p.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                  <span className="font-semibold text-sm">{formatCurrency(p.quotedTotalPrice)}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
