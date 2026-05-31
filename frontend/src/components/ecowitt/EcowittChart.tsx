'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface EcowittChartProps {
  data: { time: string; value: number }[]
  color: string
  unit: string
  height?: number
  yAxisWidth?: number
  showGrid?: boolean
}

function formatTime(timeStr: string): string {
  const parts = timeStr.split(' ');
  return parts.length > 1 ? parts[1].slice(0, 5) : timeStr.slice(0, 5);
}

export default function EcowittChart({
  data,
  color,
  unit,
  height = 180,
  yAxisWidth = 50,
  showGrid = true,
}: EcowittChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      time: formatTime(d.time),
      value: Number(d.value),
    })).filter((d) => !Number.isNaN(d.value));
  }, [data]);

  if (!chartData.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
        Không có dữ liệu
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          )}
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={yAxisWidth}
            tickFormatter={(v: number) => {
              if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
              if (v >= 100) return v.toFixed(0);
              if (v >= 10) return v.toFixed(1);
              return v.toFixed(1);
            }}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: '13px',
              padding: '8px 12px',
            }}
            labelStyle={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}
            formatter={(value: unknown) => [
              `${Number(value).toFixed(1)} ${unit}`,
            ]}
            labelFormatter={(label) => `${label}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${color.replace('#', '')})`}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
