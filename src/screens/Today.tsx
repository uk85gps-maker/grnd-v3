import { useState } from 'react';
import { formatHeaderDate } from '@/utils/dayKey';
import LifeTab from '@/screens/LifeTab';
import FoodTab from '@/components/FoodTab';

export default function Today() {
  const [activeTab, setActiveTab] = useState<'life' | 'food'>('life');

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold tracking-wide text-primary">GRND</div>
        <div className="rounded-brand border border-primary px-3 py-1 text-[11px] font-semibold text-primary">STAGE 1</div>
        <div className="text-[12px] text-text-secondary">{formatHeaderDate()}</div>
      </div>

      {/* Tab Switcher: Life | Food */}
      <div className="flex w-full border-b border-[#2a2a2a]">
        <button
          type="button"
          onClick={() => setActiveTab('life')}
          className={
            activeTab === 'life'
              ? 'flex-1 border-b-2 border-primary pb-3 text-base font-semibold text-primary'
              : 'flex-1 pb-3 text-base font-semibold text-text-secondary'
          }
        >
          Life
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('food')}
          className={
            activeTab === 'food'
              ? 'flex-1 border-b-2 border-primary pb-3 text-base font-semibold text-primary'
              : 'flex-1 pb-3 text-base font-semibold text-text-secondary'
          }
        >
          Food
        </button>
      </div>

      {activeTab === 'life' && <LifeTab />}
      {activeTab === 'food' && <FoodTab />}
    </div>
  );
}
