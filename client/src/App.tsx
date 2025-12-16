import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { useQuery, useMutation } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { FAUCET_ADDRESS } from "./config";
import ArcMiningFaucetABI from "./abi/ArcMiningFaucet.json";
import USDCABI from "./abi/USDC.json";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Gift, AlertCircle, DollarSign, AlertTriangle, Link, Clock, TrendingUp, Sparkles, Trophy, Coins, PartyPopper } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatUnits } from "viem";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SiX, SiGithub, SiTelegram, SiDiscord } from "react-icons/si";
import { LotteryWheel, type Prize } from "./components/LotteryWheel";

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const MAX_CLAIM_LIMIT = BigInt(2000 * 1000000);
const ARC_TESTNET_CHAIN_ID = 5042002;

const formatUSDC = (value: bigint | undefined) => {
  if (!value) return "0.00";
  return parseFloat(formatUnits(value, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();
  
  const { writeContract, data: hash, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);
  const [isOnCooldown, setIsOnCooldown] = useState(false);

  const isOnArcNetwork = currentChainId === ARC_TESTNET_CHAIN_ID;
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      connect({ connector: injected() });
    }
  }, [connect, isConnected]);

  useEffect(() => {
    const switchToArcNetwork = async () => {
      if (isConnected && currentChainId !== ARC_TESTNET_CHAIN_ID && !isSwitchingNetwork) {
        setIsSwitchingNetwork(true);
        try {
          await switchChain({ chainId: ARC_TESTNET_CHAIN_ID });
          toast({
            title: "Network Changed",
            description: "Switched to Arc Testnet successfully.",
          });
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Network Switch Failed",
            description: "Please switch to Arc Testnet manually in your wallet.",
          });
        } finally {
          setIsSwitchingNetwork(false);
        }
      }
    };
    switchToArcNetwork();
  }, [isConnected, currentChainId, switchChain, isSwitchingNetwork]);

  const handleSwitchNetwork = async () => {
    setIsSwitchingNetwork(true);
    try {
      await switchChain({ chainId: ARC_TESTNET_CHAIN_ID });
      toast({
        title: "Network Changed",
        description: "Switched to Arc Testnet successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Network Switch Failed",
        description: "Please switch to Arc Testnet manually in your wallet.",
      });
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const { data: claimData, refetch: refetchClaimInfo } = useReadContract({
    address: FAUCET_ADDRESS,
    abi: ArcMiningFaucetABI,
    functionName: "claimInfo",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: contractBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDCABI,
    functionName: "balanceOf",
    args: [FAUCET_ADDRESS],
    query: {
      refetchInterval: 10000,
    },
  });

  const { data: walletBalance, refetch: refetchWalletBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDCABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isOnArcNetwork,
      refetchInterval: 10000,
    },
  });

  const { data: totalClaimedData, isLoading: isLoadingTotalClaimed } = useQuery<{ totalClaimed: string; claimCount: number }>({
    queryKey: ['/api/total-claimed'],
    refetchInterval: 30000,
    staleTime: 0,
  });

  const createClaimMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; amount: string; transactionHash?: string }) => {
      const res = await apiRequest('POST', '/api/claim-history', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/total-claimed'] });
    },
  });

  const totalClaimed = claimData ? (claimData as any)[0] : BigInt(0);
  const remainingAllowance = claimData ? (claimData as any)[1] : BigInt(0);
  const hasReachedLimit = totalClaimed >= MAX_CLAIM_LIMIT;

  const handleSpinComplete = (prize: Prize) => {
    setWonPrize(prize);
    setShowWinDialog(true);
  };

  const handleClaim = () => {
    if (!isConnected || !address) return;
    if (!isOnArcNetwork) {
      toast({
        variant: "destructive",
        title: "Wrong Network",
        description: "Please switch to Arc Testnet to claim rewards.",
      });
      return;
    }
    
    writeContract({
      address: FAUCET_ADDRESS,
      abi: ArcMiningFaucetABI,
      functionName: "claim",
      chainId: ARC_TESTNET_CHAIN_ID,
    });
  };

  useEffect(() => {
    if (isConfirmed && hash && address && wonPrize) {
      createClaimMutation.mutate({
        walletAddress: address,
        amount: "200.000000",
        transactionHash: hash,
      });

      toast({
        title: "Claim Successful!",
        description: `${wonPrize.value} USDC has been sent to your wallet.`,
      });
      setShowWinDialog(false);
      setWonPrize(null);
      setIsOnCooldown(true);
      setCooldownTimeLeft(600000);
      refetchClaimInfo();
      refetchBalance();
      refetchWalletBalance();
    }
  }, [isConfirmed, hash, address, wonPrize]);

  useEffect(() => {
    if (writeError) {
      toast({
        variant: "destructive",
        title: "Claim Failed",
        description: writeError.message,
      });
    }
  }, [writeError]);

  useEffect(() => {
    if (isOnCooldown && cooldownTimeLeft > 0) {
      const timer = setInterval(() => {
        setCooldownTimeLeft(prev => {
          if (prev <= 1000) {
            setIsOnCooldown(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOnCooldown, cooldownTimeLeft]);

  const canSpin = isConnected && isOnArcNetwork && !hasReachedLimit && !isOnCooldown && !isSpinning;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center border border-primary/50 shadow-lg">
              <Gift className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-app-title">Arc Lottery Faucet</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Spin to Win USDC</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-card border border-border rounded-md px-4 py-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" data-testid="text-wallet-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 w-fit" data-testid="badge-network">Arc Testnet</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => disconnect()} className="h-6 ml-2 text-xs" data-testid="button-disconnect">
                    Disconnect
                  </Button>
                </div>
                {isOnArcNetwork && walletBalance !== undefined && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground">My Balance</span>
                    <span className="text-sm font-bold text-green-500 font-mono" data-testid="text-wallet-usdc-balance">
                      {formatUSDC(walletBalance as bigint)} USDC
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Button onClick={() => connect({ connector: injected() })} className="bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-connect">
                <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
              </Button>
            )}
          </div>
        </header>

        {!isConnected && (
          <div className="space-y-8">
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center space-y-8">
              <div className="relative">
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center border border-primary/50 shadow-2xl">
                  <Trophy className="w-14 h-14 text-primary-foreground" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-pulse" />
              </div>
              <div className="space-y-3 max-w-md">
                <h2 className="text-4xl font-bold tracking-tight">Win Free USDC!</h2>
                <p className="text-muted-foreground text-lg">Connect your wallet to spin the wheel and win USDC prizes on Arc Testnet.</p>
              </div>
              <Button 
                onClick={() => connect({ connector: injected() })} 
                size="lg"
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground px-8"
                data-testid="button-connect-hero"
              >
                <Wallet className="w-5 h-5 mr-2" /> Connect Wallet to Play
              </Button>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-primary/20 max-w-2xl mx-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Total Distributed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  {isLoadingTotalClaimed ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl font-bold text-green-500" data-testid="text-total-distributed-welcome">
                        {totalClaimedData?.totalClaimed || "0.00"} USDC
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Won by {totalClaimedData?.claimCount || 0} lucky players from the faucet
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isConnected && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4" /> Total Won
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-3xl font-bold" data-testid="text-total-claimed">{formatUSDC(totalClaimed)} USDC</div>
                  <Progress value={Number(totalClaimed) / 20000} className="h-1 mt-3 bg-primary/10" />
                  <p className="text-xs text-muted-foreground mt-2">Limit: 2,000.00 USDC per wallet</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4" /> Remaining Allowance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-3xl font-bold" data-testid="text-allowance-remaining">{formatUSDC(remainingAllowance)} USDC</div>
                  <Progress value={Number(remainingAllowance) / 20000} className="h-1 mt-3 bg-primary/10" />
                  <p className="text-xs text-muted-foreground mt-2 invisible">Placeholder</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Prize Pool
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-3xl font-bold text-green-500" data-testid="text-contract-balance">{formatUSDC(contractBalance as bigint)} USDC</div>
                  <Progress value={100} className="h-1 mt-3 bg-primary/10 invisible" />
                  <p className="text-xs text-muted-foreground mt-2">Available to win</p>
                </CardContent>
              </Card>
            </div>

            {hasReachedLimit && (
              <Alert className="bg-destructive/10 border-destructive/50">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">Limit Reached</AlertTitle>
                <AlertDescription className="text-destructive/80">
                  Your wallet has reached the maximum limit of 2,000 USDC. Spinning is no longer available for this wallet.
                </AlertDescription>
              </Alert>
            )}

            {!isOnArcNetwork && (
              <Alert className="bg-orange-500/10 border-orange-500/50">
                <Link className="h-4 w-4 text-orange-500" />
                <AlertTitle className="text-orange-500">Wrong Network</AlertTitle>
                <AlertDescription className="text-orange-400">
                  <p className="mb-2">You are not connected to Arc Testnet. Spinning and claiming are only available on Arc Testnet.</p>
                  <Button 
                    onClick={handleSwitchNetwork} 
                    disabled={isSwitchingNetwork}
                    variant="outline"
                    size="sm"
                    className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                    data-testid="button-switch-network"
                  >
                    {isSwitchingNetwork ? "Switching..." : "Switch to Arc Testnet"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isOnCooldown && (
              <Alert className="bg-blue-500/10 border-blue-500/50">
                <Clock className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-500">Cooldown Active</AlertTitle>
                <AlertDescription className="text-blue-400">
                  Wait {formatTime(cooldownTimeLeft)} before your next spin.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center py-8">
              <Card className="bg-card/50 backdrop-blur-sm border-primary/20 p-8 w-full max-w-lg">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2">Spin to Win!</h2>
                  <p className="text-muted-foreground text-sm">Try your luck and win USDC prizes instantly</p>
                </div>
                
                <LotteryWheel 
                  onSpinComplete={handleSpinComplete}
                  disabled={!canSpin}
                  isSpinning={isSpinning}
                  setIsSpinning={setIsSpinning}
                />

                {!canSpin && !isSpinning && (
                  <p className="text-center text-sm text-muted-foreground mt-6">
                    {!isOnArcNetwork && "Switch to Arc Testnet to play"}
                    {hasReachedLimit && "Wallet limit reached"}
                    {isOnCooldown && `Wait ${formatTime(cooldownTimeLeft)} to spin again`}
                  </p>
                )}
              </Card>
            </div>
          </>
        )}

        <footer className="border-t border-border/40 pt-6 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Gift className="w-4 h-4" />
              <span>Arc Lottery Faucet - Testnet Only</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://x.com/ArcNetwork" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-twitter">
                <SiX className="w-5 h-5" />
              </a>
              <a href="https://discord.gg/arcnetwork" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-discord">
                <SiDiscord className="w-5 h-5" />
              </a>
              <a href="https://t.me/arcnetwork" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-telegram">
                <SiTelegram className="w-5 h-5" />
              </a>
              <a href="https://github.com/arcnetwork" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-github">
                <SiGithub className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-xs text-muted-foreground">
              Faucet Contract: <span className="font-mono">{FAUCET_ADDRESS}</span>
            </p>
          </div>
        </footer>
      </div>

      <Dialog open={showWinDialog} onOpenChange={setShowWinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <PartyPopper className="w-6 h-6 text-yellow-500" />
              Congratulations!
            </DialogTitle>
            <DialogDescription className="text-lg pt-4">
              You won <span className="font-bold text-green-500 text-2xl">{wonPrize?.value} USDC</span>!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: wonPrize?.color }}>
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <p className="text-muted-foreground text-center">
              Click the button below to claim your prize to your wallet.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button 
              onClick={handleClaim} 
              disabled={isConfirming}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              data-testid="button-claim"
            >
              {isConfirming ? "Claiming..." : `Claim ${wonPrize?.value} USDC`}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowWinDialog(false);
                setWonPrize(null);
              }}
              className="w-full"
              data-testid="button-cancel-claim"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
