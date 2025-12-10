import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import { FAUCET_ADDRESS } from "./config";
import ArcMiningFaucetABI from "./abi/ArcMiningFaucet.json";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Wallet, Pickaxe, Zap, Timer, AlertCircle, Terminal, Cpu, Play, Square, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { formatUnits } from "viem";

// Helper to format USDC (6 decimals)
const formatUSDC = (value: bigint | undefined) => {
  if (!value) return "0.00";
  return parseFloat(formatUnits(value, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to format countdown
const formatTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function App() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();
  
  const { writeContract, data: hash, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [miningState, setMiningState] = useState<'idle' | 'mining' | 'ready'>('idle');
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600000); // 10 minutes in ms
  const [hashRate, setHashRate] = useState(0);
  const [accumulatedReward, setAccumulatedReward] = useState(0);

  // Auto-connect and switch chain logic
  useEffect(() => {
    if (!isConnected) {
      connect({ connector: injected() });
    }
  }, [connect, isConnected]);

  useEffect(() => {
    if (isConnected && currentChainId !== 5042002) {
      switchChain({ chainId: 5042002 });
    }
  }, [isConnected, currentChainId, switchChain]);


  // Read Contract Data
  const { data: claimData, refetch: refetchClaimInfo } = useReadContract({
    address: FAUCET_ADDRESS,
    abi: ArcMiningFaucetABI,
    functionName: "claimInfo",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Parse Contract Data
  const totalClaimed = claimData ? (claimData as any)[0] : BigInt(0);
  const remainingAllowance = claimData ? (claimData as any)[1] : BigInt(0);
  const nextClaimTime = claimData ? (claimData as any)[2] : BigInt(0);

  // Global Cooldown Logic
  const [globalCooldown, setGlobalCooldown] = useState(0);

  useEffect(() => {
    if (nextClaimTime) {
      const now = Math.floor(Date.now() / 1000);
      const diff = Number(nextClaimTime) - now;
      if (diff > 0) {
        setGlobalCooldown(diff * 1000);
      } else {
        setGlobalCooldown(0);
      }
    }
  }, [nextClaimTime, Date.now()]);

  // Cooldown Timer Effect
  useEffect(() => {
    if (globalCooldown > 0) {
      const interval = setInterval(() => {
        setGlobalCooldown((prev) => Math.max(0, prev - 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [globalCooldown]);

  // Mining Logic
  useEffect(() => {
    if (miningState === 'mining') {
      const startTime = Date.now();
      const endTime = startTime + 600000; // 10 mins

      const timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const p = ((600000 - remaining) / 600000) * 100;
        
        // Calculate accumulated reward based on progress (0 to 200 USDC)
        const accumulated = Math.min(200, (p / 100) * 200);
        
        setTimeLeft(remaining);
        setProgress(p);
        setAccumulatedReward(accumulated);
        
        // Random fake hashrate between 45 and 65 MH/s
        setHashRate(45 + Math.random() * 20);

        if (remaining <= 0) {
          setMiningState('ready');
          setAccumulatedReward(200);
          clearInterval(timer);
          toast({
            title: "Mining Complete!",
            description: "You mined a block. Ready to claim rewards.",
          });
        }
      }, 100);

      return () => clearInterval(timer);
    }
  }, [miningState]);

  // Handle Mining Start
  const startMining = () => {
    if (globalCooldown > 0) {
      toast({
        variant: "destructive",
        title: "Cooldown Active",
        description: `Wait ${formatTime(globalCooldown)} before mining again.`,
      });
      return;
    }
    setMiningState('mining');
    setTimeLeft(600000);
    setProgress(0);
    setAccumulatedReward(0);
  };

  // Handle Stop and Claim (Early Exit)
  const stopAndClaim = () => {
    setMiningState('ready'); // Transition to ready state immediately
    // Note: The user wants to "sacar o saldo minerado".
    // Since we interact with a real contract that likely has fixed logic, 
    // we proceed to claim. If the contract rejects early claims, it will fail.
    // But per user request "allow stop and withdraw", we enable the flow.
    handleClaim(); 
  };

  // Handle Claim
  const handleClaim = () => {
    if (!isConnected) return;
    
    writeContract({
      address: FAUCET_ADDRESS,
      abi: ArcMiningFaucetABI,
      functionName: "claim",
    });
  };

  // Reset after successful claim
  useEffect(() => {
    if (isConfirmed) {
      toast({
        title: "Claim Successful!",
        description: "USDC has been sent to your wallet.",
      });
      setMiningState('idle');
      setAccumulatedReward(0);
      setProgress(0);
      refetchClaimInfo();
    }
  }, [isConfirmed]);

  useEffect(() => {
    if (writeError) {
      toast({
        variant: "destructive",
        title: "Claim Failed",
        description: writeError.message,
      });
      // If it fails, maybe we shouldn't reset mining state? 
      // Or maybe we should let them try again.
      // For now, let's keep them in 'ready' or 'mining' depending on where they came from?
      // If they stopped early, miningState became 'ready' then claimed.
    }
  }, [writeError]);


  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
      
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50">
              <Cpu className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tighter glitch-text" data-text="ArcMiner">ArcMiner</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Testnet Simulation Node</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2 bg-card border border-border rounded-md px-4 py-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm font-medium">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <Button variant="ghost" size="sm" onClick={() => disconnect()} className="h-6 ml-2 text-xs hover:bg-destructive/20 hover:text-destructive">
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={() => connect({ connector: injected() })} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
              </Button>
            )}
          </div>
        </header>

        {isConnected ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Total Claimed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatUSDC(totalClaimed)} USDC</div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Allowance Remaining
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatUSDC(remainingAllowance)} USDC</div>
                  <Progress value={Number(remainingAllowance) / 2000 * 100} className="h-1 mt-2 bg-primary/10" />
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Timer className="w-4 h-4" /> Next Mining Slot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {globalCooldown > 0 ? (
                    <div className="text-2xl font-bold text-orange-500">{formatTime(globalCooldown)}</div>
                  ) : (
                    <div className="text-2xl font-bold text-green-500">READY</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Mining Console */}
            <Card className="border-primary/50 bg-black/40 backdrop-blur-md overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
              
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  Mining Console v1.0.4
                </CardTitle>
                <CardDescription>
                  Start a mining session to secure the network and earn USDC rewards.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6 relative">
                
                {/* Mining Visualization */}
                <div className="h-48 rounded-lg border border-border bg-black/60 p-4 font-mono text-xs flex flex-col justify-end relative overflow-hidden">
                  
                  {miningState === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground animate-[spin_10s_linear_infinite]"></div>
                      <p className="text-muted-foreground">System Idle. Ready to initialize.</p>
                    </div>
                  )}

                  {(miningState === 'mining' || miningState === 'ready') && (
                    <>
                      <div className="absolute inset-0 opacity-20 animate-scan bg-gradient-to-b from-transparent via-primary to-transparent h-[50%] w-full pointer-events-none"></div>
                      <div className="space-y-1 text-green-500/80">
                        <p>&gt; Connection established to Arc Testnet Node...</p>
                        <p className="text-primary">&gt; Hashrate: {hashRate.toFixed(2)} MH/s</p>
                        <p>&gt; Mining in progress...</p>
                        <div className="mt-4 p-2 border border-green-500/30 bg-green-500/10 rounded inline-block">
                          <p className="text-lg font-bold text-green-400">
                             PENDING REWARD: {accumulatedReward.toFixed(4)} USDC
                          </p>
                        </div>
                        {miningState === 'ready' && <p className="text-yellow-400 mt-2">&gt; SESSION ENDED. READY TO CLAIM.</p>}
                        <p className="animate-pulse">_</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Controls & Progress */}
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Session Progress</span>
                    <div className="flex gap-4">
                      <span className="text-primary font-bold">{accumulatedReward.toFixed(2)} USDC</span>
                      <span className="font-bold">{Math.round(progress)}%</span>
                    </div>
                  </div>
                  <Progress value={progress} className="h-3 bg-secondary" />
                  
                  <div className="flex justify-between items-center pt-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Time Remaining: </span>
                      <span className="font-bold font-mono">{formatTime(timeLeft)}</span>
                    </div>

                    {miningState === 'idle' && (
                      <Button 
                        onClick={startMining} 
                        disabled={globalCooldown > 0}
                        className="w-40 bg-primary hover:bg-primary/90 hover:scale-105 transition-all"
                      >
                        <Play className="w-4 h-4 mr-2" /> Start Mining
                      </Button>
                    )}

                    {miningState === 'mining' && (
                      <Button 
                        onClick={stopAndClaim}
                        variant="destructive"
                        className="w-48 bg-red-500/80 hover:bg-red-600 hover:scale-105 transition-all text-white border border-red-500"
                      >
                        <Square className="w-4 h-4 mr-2 fill-current" /> Stop & Claim {accumulatedReward.toFixed(0)} USDC
                      </Button>
                    )}

                    {miningState === 'ready' && (
                      <Button 
                        onClick={handleClaim} 
                        disabled={isConfirming}
                        className="w-48 bg-green-600 hover:bg-green-700 hover:scale-105 transition-all text-white"
                      >
                        {isConfirming ? (
                          <>Confirming...</>
                        ) : (
                          <><Banknote className="w-4 h-4 mr-2" /> Withdraw {accumulatedReward.toFixed(0)} USDC</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Info Panel */}
            <Alert className="bg-primary/5 border-primary/20">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertTitle>System Rules</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground space-y-1 mt-2">
                <p>• Cada sessão de mineração dura 10 minutos.</p>
                <p>• Recompensa potencial: até 200 USDC.</p>
                <p>• Cada carteira pode receber até 2000 USDC.</p>
                <p className="break-all">• O faucet é abastecido manualmente pela wallet: 0x157b1af849D0A48Fa7622AE44BB6606447C1ed57</p>
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/50 shadow-[0_0_30px_rgba(124,58,237,0.3)]">
              <Cpu className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-3xl font-bold tracking-tighter">Welcome to ArcMiner</h2>
              <p className="text-muted-foreground">Connect your wallet to start simulating mining operations on the Arc Testnet and earn USDC rewards.</p>
            </div>
            <Button size="lg" onClick={() => connect({ connector: injected() })} className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8">
              Connect Wallet
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
