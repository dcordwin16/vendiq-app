interface StatCardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  accent: 'blue' | 'green' | 'purple' | 'orange'
}

const accentMap = {
  blue: 'bg-blue-600/20 border-blue-600/30 text-blue-400',
  green: 'bg-green-600/20 border-green-600/30 text-green-400',
  purple: 'bg-purple-600/20 border-purple-600/30 text-purple-400',
  orange: 'bg-orange-600/20 border-orange-600/30 text-orange-400',
}

export default function StatCard({ title, value, subtitle, icon, accent }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${accentMap[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="text-white text-2xl font-bold mb-1">{value}</div>
      <div className="text-gray-500 text-xs">{subtitle}</div>
    </div>
  )
}
