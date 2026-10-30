import React, { useState, useRef, useEffect } from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: (TabItem | string)[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  'aria-label'?: string;
}

interface SingleTabProps {
  id: string;
  label: string;
  count?: number;
  isActive: boolean;
  onSelect: () => void;
  onArrowNav: (direction: 'left' | 'right') => void;
}

const SingleTab = React.forwardRef<HTMLButtonElement, SingleTabProps>(
  ({ id, label, count, isActive, onSelect, onArrowNav }, ref) => {
    const [isTapped, setIsTapped] = useState<boolean>(false);
    const tapTimerRef = useRef<number | null>(null);

    const triggerTap = () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      setIsTapped(true);
    };

    const releaseTap = () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
      tapTimerRef.current = window.setTimeout(() => {
        setIsTapped(false);
        tapTimerRef.current = null;
      }, 250);
    };

    useEffect(() => {
      return () => {
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
        }
      };
    }, []);

    const handlePointerDown = () => {
      triggerTap();
    };

    const handlePointerUp = () => {
      releaseTap();
    };

    const handlePointerCancel = () => {
      releaseTap();
    };

    const handlePointerLeave = () => {
      if (isTapped) {
        releaseTap();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onArrowNav('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onArrowNav('right');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerTap();
        releaseTap();
        onSelect();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`tab-${id}`}
        aria-selected={isActive}
        aria-controls={`tabpanel-${id}`}
        tabIndex={isActive ? 0 : -1}
        onClick={onSelect}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        className={`ia-tab ${isActive ? 'ia-tab-active' : ''} ${
          isTapped ? 'is-tapped' : ''
        }`}
      >
        <span>{label}</span>
        {count !== undefined && (
          <span
            className={`text-xs ml-1.5 px-1.5 py-0.5 rounded-full font-mono font-semibold transition-colors ${
              isActive
                ? 'bg-white text-[#E0202A]'
                : 'bg-white/20 text-white'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  }
);

SingleTab.displayName = 'SingleTab';

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'Section tabs',
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const normalizedTabs: TabItem[] = tabs.map((tab) =>
    typeof tab === 'string' ? { id: tab, label: tab } : tab
  );

  const handleArrowNav = (currentIndex: number, direction: 'left' | 'right') => {
    const total = normalizedTabs.length;
    if (total === 0) return;
    const nextIndex =
      direction === 'left'
        ? (currentIndex - 1 + total) % total
        : (currentIndex + 1) % total;

    const nextTab = tabRefs.current[nextIndex];
    if (nextTab) {
      nextTab.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-2 font-sans ${className}`}
    >
      {normalizedTabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <SingleTab
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={tab.id}
            label={tab.label}
            count={tab.count}
            isActive={isActive}
            onSelect={() => onChange(tab.id)}
            onArrowNav={(dir) => handleArrowNav(idx, dir)}
          />
        );
      })}
    </div>
  );
};

export default Tabs;
