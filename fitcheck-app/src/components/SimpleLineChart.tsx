import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../constants/theme';

interface DataPoint {
  label: string;
  value: number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  label?: string;
}

export default function SimpleLineChart({
  data,
  height = 200,
  color = Colors.primary,
  label,
}: SimpleLineChartProps) {
  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noData}>No data available</Text>
      </View>
    );
  }

  const width = Dimensions.get('window').width - 48; // Padding
  const chartWidth = width - 40; // Left margin for Y-axis labels
  const chartHeight = height - 40; // Bottom margin for X-axis labels

  const maxValue = Math.max(...data.map(d => d.value), 10); // Min 10 for scale
  const minValue = Math.min(...data.map(d => d.value), 0);
  const valueRange = maxValue - minValue || 1;

  const pointWidth = chartWidth / Math.max(data.length - 1, 1);

  // Generate path for line
  const points = data.map((point, index) => {
    const x = index * pointWidth;
    const y = chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: point.value };
  });

  return (
    <View style={[styles.container, { height }]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.chart}>
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const value = minValue + (valueRange * ratio);
          const y = chartHeight - (chartHeight * ratio);

          return (
            <View key={index} style={[styles.gridLine, { top: y }]}>
              <Text style={styles.yAxisLabel}>{value.toFixed(1)}</Text>
              <View style={styles.gridLineDash} />
            </View>
          );
        })}

        {/* Data line */}
        <View style={[styles.lineContainer, { marginLeft: 40 }]}>
          {points.map((point, index) => {
            if (index === 0) return null;

            const prevPoint = points[index - 1];
            const lineWidth = Math.sqrt(
              Math.pow(point.x - prevPoint.x, 2) +
              Math.pow(point.y - prevPoint.y, 2)
            );
            const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * (180 / Math.PI);

            return (
              <View
                key={index}
                style={[
                  styles.line,
                  {
                    left: prevPoint.x,
                    top: prevPoint.y,
                    width: lineWidth,
                    backgroundColor: color,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}

          {/* Data points */}
          {points.map((point, index) => (
            <View
              key={`point-${index}`}
              style={[
                styles.point,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                  backgroundColor: color,
                },
              ]}
            >
              <View style={styles.pointInner} />
            </View>
          ))}
        </View>

        {/* X-axis labels */}
        <View style={[styles.xAxisContainer, { marginLeft: 40 }]}>
          {data.map((point, index) => {
            // Show every nth label to avoid crowding
            const showEvery = Math.ceil(data.length / 5);
            if (index % showEvery !== 0 && index !== data.length - 1) return null;

            return (
              <Text
                key={index}
                style={[
                  styles.xAxisLabel,
                  { left: points[index].x - 20 },
                ]}
              >
                {point.label}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  noData: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 80,
  },
  chart: {
    position: 'relative',
    flex: 1,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    width: 35,
    textAlign: 'right',
  },
  gridLineDash: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    marginLeft: 5,
  },
  lineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
  },
  line: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  point: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointInner: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFF',
  },
  xAxisContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  xAxisLabel: {
    position: 'absolute',
    fontSize: 9,
    color: Colors.textMuted,
    width: 40,
    textAlign: 'center',
  },
});
