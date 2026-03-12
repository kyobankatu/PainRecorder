import PainGraph from '@/components/PainGraph';

export default function GraphPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">痛みの推移グラフ</h1>
      <PainGraph />
    </div>
  );
}
