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
  { id: 0, label: "1000 USDC", value: 1000, color: "#1e3a5f", chance: "2%" },
  { id: 1, label: "200 USDC", value: 200, color: "#8b5cf6", chance: "3%" },
  { id: 2, label: "100 USDC", value: 100, color: "#f472b6", chance: "10%" },
  { id: 3, label: "50 USDC", value: 50, color: "#f59e0b", chance: "10%" },
  { id: 4, label: "20 USDC", value: 20, color: "#06b6d4", chance: "20%" },
  { id: 5, label: "10 USDC", value: 10, color: "#FFD700", chance: "15%" },
  { id: 6, label: "0 USDC", value: 0, color: "#374151", chance: "40%" },
];

export function getPrizeIndexByRoll(roll: number): number {
  if (roll <= 1) return 0;   // 0-1   -> 1000 USDC
  if (roll <= 4) return 1;   // 2-4   -> 200 USDC
  if (roll <= 14) return 2;  // 5-14  -> 100 USDC
  if (roll <= 24) return 3;  // 15-24 -> 50 USDC
  if (roll <= 44) return 4;  // 25-44 -> 20 USDC
  if (roll <= 59) return 5;  // 45-59 -> 10 USDC
  return 6;                  // 60-99 -> 0 USDC
}

export function getPrizeIndexByBigInt(rewardBigInt: bigint): number {
  const USDC_DIVISOR = BigInt(1000000);
  const rewardValue = Number(rewardBigInt / USDC_DIVISOR);
  
  switch (rewardValue) {
    case 1000: return 0;
    case 200:  return 1;
    case 100:  return 2;
    case 50:   return 3;
    case 20:   return 4;
    case 10:   return 5;
    default:   return 6;
  }
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
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-20 w-0 h-0 border-l-[22px] border-r-[22px] border-t-[37px] border-l-transparent border-r-transparent border-t-[#39FF14] drop-shadow-[0_0_10px_rgba(57,255,20,0.8)]" />
      
      <div className="relative w-[422px] h-[422px] md:w-[591px] md:h-[591px]">
        <div
          ref={wheelRef}
          className="w-full h-full rounded-full border-[9px] border-yellow-500 shadow-[0_0_75px_rgba(255,215,0,0.5)] overflow-hidden"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isAnimating ? 'transform 10s cubic-bezier(0.15, 0, 0.15, 1)' : 'none',
            boxShadow: '0 0 75px rgba(255, 215, 0, 0.5), inset 0 0 45px rgba(0,0,0,0.6)',
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
                    className={prize.id === 0 ? "animate-neon-pulse" : ""}
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill="white"
                    fontSize={prize.value >= 100 ? "5" : "5.5"}
                    fontWeight="black"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                    className={prize.id === 0 ? "animate-neon-text" : ""}
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
          <div className="flex flex-col items-center gap-2 relative">
            <Button
              onClick={onSpin}
              disabled={isSpinBusy || disabled}
              className="pointer-events-auto rounded-full bg-gradient-to-br from-lime-400 to-lime-500 text-black hover:from-lime-300 hover:to-lime-400 text-xl font-bold shadow-2xl shadow-lime-500/50 border-6 border-green-500 transition-all active:scale-95 active:border-transparent flex items-center justify-center p-0 mt-12"
              style={{ width: '132px', height: '132px' }}
              data-testid="button-spin"
            >
              {!isWaitingForBlockchain && !isAnimating && (
                <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
                  <Zap style={{ width: '42px', height: '42px' }} />
                  <span style={{ fontSize: '18px' }}>SPIN</span>
                </div>
              )}
            </Button>
            {(isWaitingForBlockchain || isAnimating) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin" style={{ width: '54px', height: '54px' }} />
              </div>
            )}
            {spinStatus && !spinStatus.includes("disabled due to low contract liquidity") && (
              <div className="pointer-events-none bg-black/80 rounded-lg px-3 py-1 text-center mt-40 mb-12">
                <span className="text-xs text-yellow-400 font-medium whitespace-pre-line leading-relaxed">
                  {spinStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#1e3a5f" }} />
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
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#FFD700" }} />
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
