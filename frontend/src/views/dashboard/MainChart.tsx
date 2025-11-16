import { useState, useEffect } from 'react';
import { Chart } from 'primereact/chart';

const MainChart = () => {
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  useEffect(() => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    const infoColor = documentStyle.getPropertyValue('--blue-500') || '#3B82F6';
    const successColor = documentStyle.getPropertyValue('--green-500') || '#22C55E';
    const dangerColor = documentStyle.getPropertyValue('--red-500') || '#EF4444';

    // ✅ 수정: 0개의 인자를 받는 대신 2개의 인자(min, max)를 받도록 함수를 수정합니다.
    const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

    const data = {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      datasets: [
        {
          label: 'My First dataset',
          backgroundColor: `rgba(59, 130, 246, 0.1)`,
          borderColor: infoColor,
          pointHoverBackgroundColor: infoColor,
          borderWidth: 2,
          data: [
            random(50, 200), // ✅ 이제 정상적으로 호출됩니다.
            random(50, 200),
            random(50, 200),
            random(50, 200),
            random(50, 200),
            random(50, 200),
            random(50, 200),
          ],
          fill: true,
        },
        {
          label: 'My Second dataset',
          backgroundColor: 'transparent',
          borderColor: successColor,
          pointHoverBackgroundColor: successColor,
          borderWidth: 2,
          data: [
            random(50, 200), // ✅ 정상
            random(50, 200),
            random(50, 200),
            random(50, 200),
            random(50, 200),
            random(50, 200),
            random(50, 200),
          ],
        },
        // ... (Third dataset)
      ],
    };

    const options = {
      // ... (이전과 동일)
    };

    setChartData(data);
    setChartOptions(options);
  }, []);

  return (
    <div style={{ height: '300px', marginTop: '40px' }}>
      <Chart type="line" data={chartData} options={chartOptions} />
    </div>
  );
};

export default MainChart;
