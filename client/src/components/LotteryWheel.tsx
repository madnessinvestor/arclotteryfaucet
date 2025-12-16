import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface Prize {
  id: number;
  label: string;
  value: number;
  color: string;
}

const prizes: Prize[] = [
  { id: 0, label: "200 USDC", value: 200, color: "#10b981" },
  { id: 1, label: "200 USDC", value: 200, color: "#8b5cf6" },
  { id: 2, label: "200 USDC", value: 200, color: "#f472b6" },
  { id: 3, label: "200 USDC", value: 200, color: "#10b981" },
  { id: 4, label: "200 USDC", value: 200, color: "#ef4444" },
  { id: 5, label: "200 USDC", value: 200, color: "#8b5cf6" },
  { id: 6, label: "200 USDC", value: 200, color: "#10b981" },
  { id: 7, label: "200 USDC", value: 200, color: "#6b7280" },
  { id: 8, label: "200 USDC", value: 200, color: "#8b5cf6" },
  { id: 9, label: "200 USDC", value: 200, color: "#ef4444" },
  { id: 10, label: "200 USDC", value: 200, color: "#10b981" },
  { id: 11, label: "200 USDC", value: 200, color: "#8b5cf6" },
];

interface LotteryWheelProps {
  onSpinComplete: (prize: Prize) => void;
  disabled?: boolean;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
}

export function LotteryWheel({ onSpinComplete, disabled, isSpinning, setIsSpinning }: LotteryWheelProps) {
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  const spinWheel = () => {
    if (isSpinning || disabled) return;
    
    setIsSpinning(true);
    
    const spinDuration = 5000;
    const minSpins = 5;
    const maxSpins = 8;
    const spins = minSpins + Math.random() * (maxSpins - minSpins);
    
    const selectedIndex = Math.floor(Math.random() * prizes.length);
    
    const segmentAngle = 360 / prizes.length;
    const targetAngle = 360 - (selectedIndex * segmentAngle) - (segmentAngle / 2);
    const totalRotation = spins * 360 + targetAngle;
    
    setRotation(prev => prev + totalRotation);
    
    setTimeout(() => {
      setIsSpinning(false);
      onSpinComplete(prizes[selectedIndex]);
    }, spinDuration);
  };

  const segmentAngle = 360 / prizes.length;

  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute -top-2 z-20 w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-lg" />
      
      <div className="relative w-[320px] h-[320px] md:w-[400px] md:h-[400px]">
        <div
          ref={wheelRef}
          className="w-full h-full rounded-full border-4 border-border shadow-2xl overflow-hidden"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {prizes.map((prize, index) => {
              const startAngle = index * segmentAngle - 90;
              const endAngle = startAngle + segmentAngle;
              
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              
              const x1 = 50 + 50 * Math.cos(startRad);
              const y1 = 50 + 50 * Math.sin(startRad);
              const x2 = 50 + 50 * Math.cos(endRad);
              const y2 = 50 + 50 * Math.sin(endRad);
              
              const largeArc = segmentAngle > 180 ? 1 : 0;
              
              const midAngle = startAngle + segmentAngle / 2;
              const midRad = (midAngle * Math.PI) / 180;
              const textX = 50 + 32 * Math.cos(midRad);
              const textY = 50 + 32 * Math.sin(midRad);
              
              return (
                <g key={prize.id}>
                  <path
                    d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={prize.color}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill="white"
                    fontSize="4"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  >
                    {prize.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Button
            onClick={spinWheel}
            disabled={isSpinning || disabled}
            className="pointer-events-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-foreground text-background hover:bg-foreground/90 text-lg font-bold shadow-xl border-4 border-background"
            data-testid="button-spin"
          >
            <Zap className="w-5 h-5 mr-1" />
            SPIN
          </Button>
        </div>
      </div>
    </div>
  );
}

export type { Prize };
