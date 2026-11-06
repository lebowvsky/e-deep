import { HealthCard } from '@/features/health/components/HealthCard';

export function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <title>Dashboard · E-Deep Admin</title>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <HealthCard />
      </div>
    </div>
  );
}
