import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-80 bg-slate-200 rounded"></div>
          <div className="h-4 w-96 bg-slate-100 rounded"></div>
        </div>
        <div className="h-8 w-48 bg-slate-200 rounded-full"></div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <div className="h-8 w-36 bg-slate-200 rounded-lg"></div>
          <div className="h-8 w-36 bg-slate-200 rounded-lg"></div>
          <div className="h-8 w-36 bg-slate-200 rounded-lg"></div>
        </div>
        <div className="h-8 w-32 bg-slate-200 rounded-lg"></div>
      </div>

      {/* KPI Stats Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="h-3 w-20 bg-slate-200 rounded"></div>
            <div className="h-8 w-14 bg-slate-300 rounded"></div>
            <div className="h-2.5 w-24 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>

      {/* Charts Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
          <div className="h-3 w-64 bg-slate-100 rounded"></div>
          <div className="h-64 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
          <div className="h-3 w-64 bg-slate-100 rounded"></div>
          <div className="h-64 bg-slate-100 rounded-lg"></div>
        </div>
      </div>

      {/* Tables Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="h-4 w-40 bg-slate-200 rounded"></div>
          <div className="h-40 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="h-4 w-40 bg-slate-200 rounded"></div>
          <div className="h-40 bg-slate-100 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
};

