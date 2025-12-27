import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Loader2 } from "lucide-react";

export interface Prize {
  id: number;
  label: string;
  value: number;
  color: string;
  chance: string;
}

export const prizes: Prize[] = [
  { id: 0, label: "1000 USDC", value: 1000, color: "#FFD700" , chance: "2%" },
  { id: 1, label: "Nothing", value: 0, color: "#374151", chance: "40%" },
  { id: 2, label: "200 USDC", value: 200, color: "#8b5cf6", chance: "3%" },
  { id: 3, label: "0 USDC", value: 0, color: "#4B5563", chance: "40%" },
  { id: 4, label: "100 USDC", value: 100, color: "#f472b6", chance: "10%" },
  { id: 5, label: "50 USDC", value: 50, color: "#f59e0b", chance: "10%" },
  { id: 6, label: "20 USDC", value: 20, color: "#06b6d4", chance: "20%" },
  { id: 7, label: "Nothing", value: 0, color: "#374151", chance: "40%" },
  { id: 8, label: "10 USDC", value: 10, color: "#3b82f6", chance: "15%" },
  { id: 9, label: "0 USDC", value: 0, color: "#4B5563", chance: "40%" },
  { id: 10, label: "10 USDC", value: 10, color: "#3b82f6", chance: "15%" },
  { id: 11, label: "Nothing", value: 0, color: "#374151", chance: "40%" },
];

export function getPrizeIndexByBigInt(rewardBigInt: bigint): number {
  const USDC_DIVISOR = BigInt(1000000);
  const rewardValue = rewardBigInt / USDC_DIVISOR;
  
  const matchingPrizes = prizes.filter(p => BigInt(p.value) === rewardValue);
  if (matchingPrizes.length === 0) {
    const nothingPrizes = prizes.filter(p => p.value === 0);
    if (nothingPrizes.length > 0) {
      return nothingPrizes[Math.floor(Math.random() * nothingPrizes.length)].id;
    }
    return 1;
  }
  return matchingPrizes[Math.floor(Math.random() * matchingPrizes.length)].id;
}

export function getPrizeIndexByValue(value: number): number {
  const matchingPrizes = prizes.filter(p => p.value === value);
  if (matchingPrizes.length === 0) {
    return prizes.findIndex(p => p.value === 0);
  }
  const randomMatch = matchingPrizes[Math.floor(Math.random() * matchingPrizes.length)];
  return randomMatch.id;
}

interface LotteryWheelProps {
  onSpin: () => void;
  disabled?: boolean;
  isWaitingForBlockchain: boolean;
  isAnimating: boolean;
  spinStatus: string;
  targetPrizeIndex: number | null;
  rotation: number;
}

export function LotteryWheel({ onSpin, disabled, isWaitingForBlockchain, isAnimating, spinStatus, rotation }: LotteryWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const segmentAngle = 360 / prizes.length;
  const isSpinBusy = isWaitingForBlockchain || isAnimating;

  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute -top-2 z-20 w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
      
      <div className="relative w-[360px] h-[360px] md:w-[480px] md:h-[480px]">
        <div
          ref={wheelRef}
          className="w-full h-full rounded-full border-4 border-yellow-500/50 shadow-2xl overflow-hidden"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isAnimating ? 'transform 10s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            boxShadow: '0 0 60px rgba(255, 215, 0, 0.3), inset 0 0 30px rgba(0,0,0,0.3)',
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
              const textX = 50 + 35 * Math.cos(midRad);
              const textY = 50 + 35 * Math.sin(midRad);
              
              return (
                <g key={prize.id}>
                  <path
                    d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={prize.color}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="0.3"
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill="white"
                    fontSize={prize.value >= 100 ? "4" : "4.5"}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {prize.label}
                  </text>
                </g>
              );
            })}
            <circle cx="50" cy="50" r="10" fill="url(#centerGradient)" stroke="#FFD700" strokeWidth="0.5" />
            <defs>
              <radialGradient id="centerGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#4a4a4a" />
                <stop offset="100%" stopColor="#1a1a1a" />
              </radialGradient>
            </defs>
          </svg>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={onSpin}
              disabled={isSpinBusy || disabled}
              className="pointer-events-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 text-lg font-bold shadow-xl border-4 border-yellow-300"
              data-testid="button-spin"
            >
              {isWaitingForBlockchain ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isAnimating ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-1" />
                  SPIN
                </>
              )}
            </Button>
            {spinStatus && (
              <div className="pointer-events-none bg-black/80 rounded-lg px-3 py-1 text-center">
                <span className="text-xs text-yellow-400 font-medium">{spinStatus}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#FFD700" }} />
          <span className="text-muted-foreground">1000 USDC (2%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
          <span className="text-muted-foreground">200 USDC (3%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f472b6" }} />
          <span className="text-muted-foreground">100 USDC (10%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
          <span className="text-muted-foreground">50 USDC (10%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#06b6d4" }} />
          <span className="text-muted-foreground">20 USDC (20%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
          <span className="text-muted-foreground">10 USDC (15%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#374151" }} />
          <span className="text-muted-foreground">Nothing (40%)</span>
        </div>
      </div>
    </div>
  );
}

export type { Prize as PrizeType };
