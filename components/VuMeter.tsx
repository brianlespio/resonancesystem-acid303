import React, { useEffect, useRef } from 'react';

interface VuMeterProps {
  analyser: AnalyserNode | null;
}

const VuMeter: React.FC<VuMeterProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const bufferLength = analyser ? analyser.fftSize : 256;
    const dataArray = new Float32Array(bufferLength);

    let animationId: number;
    let currentLevelL = 0;
    let currentLevelR = 0;
    let peakHoldL = 0;
    let peakHoldR = 0;
    let peakTimerL = 0;
    let peakTimerR = 0;

    // 7 vertical LED segments from bottom (-18dB) to top (+3dB CLIP)
    const NUM_SEGMENTS = 7;
    const segmentThresholds = [0.10, 0.25, 0.45, 0.62, 0.76, 0.88, 0.96];

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      let targetLevelL = 0;
      let targetLevelR = 0;

      if (analyser) {
        analyser.getFloatTimeDomainData(dataArray);

        let sumSquares = 0;
        let peak = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = dataArray[i];
          const abs = Math.abs(val);
          if (abs > peak) peak = abs;
          sumSquares += val * val;
        }

        const rms = Math.sqrt(sumSquares / bufferLength);

        // Responsive target levels with studio headroom scaling
        targetLevelL = Math.min(1.0, rms * 2.8 + peak * 0.3);
        targetLevelR = Math.min(1.0, rms * 2.6 + peak * 0.35);
      }

      // Analog VU Ballistics: Smooth attack and gentle analog decay
      if (targetLevelL > currentLevelL) {
        currentLevelL += (targetLevelL - currentLevelL) * 0.6;
      } else {
        currentLevelL *= 0.86;
      }

      if (targetLevelR > currentLevelR) {
        currentLevelR += (targetLevelR - currentLevelR) * 0.6;
      } else {
        currentLevelR *= 0.86;
      }

      // Peak Hold
      if (currentLevelL > peakHoldL) {
        peakHoldL = currentLevelL;
        peakTimerL = 28;
      } else if (peakTimerL > 0) {
        peakTimerL--;
      } else {
        peakHoldL = Math.max(0, peakHoldL - 0.025);
      }

      if (currentLevelR > peakHoldR) {
        peakHoldR = currentLevelR;
        peakTimerR = 28;
      } else if (peakTimerR > 0) {
        peakTimerR--;
      } else {
        peakHoldR = Math.max(0, peakHoldR - 0.025);
      }

      // Background
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const width = rect.width;
      const height = rect.height;

      const barWidth = 7;
      const xLeft = 3;
      const xRight = width - barWidth - 3;
      const xCenter = width / 2;

      const topPadding = 2;
      const bottomPadding = 2;
      const availableHeight = height - topPadding - bottomPadding;
      const segGap = 1.2;
      const segHeight = (availableHeight - (NUM_SEGMENTS - 1) * segGap) / NUM_SEGMENTS;

      // Draw Center VU scale markings
      ctx.font = 'bold 5.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const labels = [
        { text: '+3', idx: 6, color: '#ef4444' },
        { text: '0',  idx: 5, color: '#f59e0b' },
        { text: '-6', idx: 3, color: '#888888' },
        { text: '-18', idx: 0, color: '#555555' }
      ];

      labels.forEach(label => {
        const segY = height - bottomPadding - (label.idx + 0.5) * (segHeight + segGap);
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, xCenter, segY);
      });

      // Render Each Segment for Left and Right Channels
      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const segY = height - bottomPadding - (i + 1) * segHeight - i * segGap;
        const thresh = segmentThresholds[i];

        const isPeak = (i === NUM_SEGMENTS - 1);
        const is0dB = (i === NUM_SEGMENTS - 2);

        const isLitL = currentLevelL >= thresh;
        const isLitR = currentLevelR >= thresh;

        const isPeakHoldL = Math.abs(peakHoldL - thresh) < 0.08 && peakHoldL >= thresh;
        const isPeakHoldR = Math.abs(peakHoldR - thresh) < 0.08 && peakHoldR >= thresh;

        // Choose segment active colors
        let litColor = '#f59e0b'; // Vintage Amber-500
        let glowColor = 'rgba(245, 158, 11, 0.8)';

        if (isPeak) {
          litColor = '#ef4444'; // Red Peak
          glowColor = 'rgba(239, 68, 68, 0.8)';
        } else if (is0dB) {
          litColor = '#fbbf24'; // Bright Amber 0dB
          glowColor = 'rgba(251, 191, 36, 0.8)';
        } else if (i < 2) {
          litColor = '#d97706'; // Warm deep amber
          glowColor = 'rgba(217, 119, 6, 0.7)';
        }

        // Unlit smoked lens
        const unlitColor = isPeak ? '#230f0f' : '#1c150b';
        const unlitBorder = isPeak ? '#381616' : '#281d0e';

        // --- Left Segment ---
        ctx.save();
        if (isLitL || isPeakHoldL) {
          ctx.fillStyle = litColor;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 4;
          ctx.fillRect(xLeft, segY, barWidth, segHeight);
          // Highlight sheen
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(xLeft, segY, barWidth, 0.6);
        } else {
          ctx.fillStyle = unlitColor;
          ctx.strokeStyle = unlitBorder;
          ctx.lineWidth = 0.5;
          ctx.fillRect(xLeft, segY, barWidth, segHeight);
          ctx.strokeRect(xLeft + 0.25, segY + 0.25, barWidth - 0.5, segHeight - 0.5);
        }
        ctx.restore();

        // --- Right Segment ---
        ctx.save();
        if (isLitR || isPeakHoldR) {
          ctx.fillStyle = litColor;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 4;
          ctx.fillRect(xRight, segY, barWidth, segHeight);
          // Highlight sheen
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(xRight, segY, barWidth, 0.6);
        } else {
          ctx.fillStyle = unlitColor;
          ctx.strokeStyle = unlitBorder;
          ctx.lineWidth = 0.5;
          ctx.fillRect(xRight, segY, barWidth, segHeight);
          ctx.strokeRect(xRight + 0.25, segY + 0.25, barWidth - 0.5, segHeight - 0.5);
        }
        ctx.restore();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser]);

  return (
    <div className="flex flex-col items-center justify-between select-none h-full py-0.5" title="Output Level VU Meter">
      <div className="flex items-center justify-between w-full px-0.5 text-[6.5px] font-bold text-neutral-400 font-mono tracking-wider leading-none mb-0.5">
        <span>L</span>
        <span className="text-amber-500 font-black">VU</span>
        <span>R</span>
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-11 h-[21px] block rounded-sm"
      />
    </div>
  );
};

export default VuMeter;
