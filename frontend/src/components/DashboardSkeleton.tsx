import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 font-sans">
      {/* Hero Skeleton */}
      <div className="pt-2 pb-6 space-y-3">
        <div className="h-10 w-96 skeleton-shimmer rounded-[8px]" />
        <div className="h-4 w-72 skeleton-shimmer rounded-[8px]" />
        <div className="flex gap-3 pt-4">
          <div className="h-10 w-32 skeleton-shimmer rounded-[8px]" />
          <div className="h-10 w-28 skeleton-shimmer rounded-[8px]" />
        </div>
      </div>

      <div className="border-b border-[#E6E6E6]" />

      {/* Stat Cards Skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-20 skeleton-shimmer rounded-[8px]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-6 bg-white border border-[#E6E6E6] rounded-[8px] space-y-3 shadow-subtle">
              <div className="h-8 w-16 skeleton-shimmer rounded-[8px]" />
              <div className="h-4 w-28 skeleton-shimmer rounded-[8px]" />
            </div>
          ))}
        </div>
      </div>

      {/* Needs Attention Skeleton */}
      <div className="space-y-3 pt-4">
        <div className="h-4 w-32 skeleton-shimmer rounded-[8px]" />
        <div className="border-t border-[#E6E6E6] divide-y divide-[#E6E6E6]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="py-4 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-60 skeleton-shimmer rounded-[8px]" />
                <div className="h-3 w-40 skeleton-shimmer rounded-[8px]" />
              </div>
              <div className="h-4 w-24 skeleton-shimmer rounded-[8px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
