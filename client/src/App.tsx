import { useState, useEffect, useCallback, useMemo } from "react";
import { BrowserProvider, Contract, formatUnits, JsonRpcProvider } from "ethers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Gift, AlertCircle, AlertTriangle, Clock, Trophy, Sparkles, PartyPopper, Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { LotteryWheel, prizes, getPrizeIndexByBigInt, type Prize } from "./components/LotteryWheel";
import { 
  SPIN_CONTRACT_ADDRESS, 
  USDC_ADDRESS, 
  ARC_TESTNET, 
  SPIN_CONTRACT_ABI, 
  USDC_ABI, 
  MAX_SPINS_PER_DAY,
  MIN_CONTRACT_BALANCE
} from "./config";
import { SiX, SiGithub, SiTelegram, SiDiscord } from "react-icons/si";

const formatUSDC = (value: bigint | undefined) => {
  if (!value) return "0.00";
  return parseFloat(formatUnits(value, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOnArcNetwork, setIsOnArcNetwork] = useState(false);
  const [walletBalance, setWalletBalance] = useState<bigint | undefined>();
  const [spinsLeft, setSpinsLeft] = useState<number | null>(null);
  const [nextResetTime, setNextResetTime] = useState<number>(0);
  const [isWaitingForBlockchain, setIsWaitingForBlockchain] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinStatus, setSpinStatus] = useState<string>("");
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [contractBalance, setContractBalance] = useState<string>("0.00");
  const [contractBalanceRaw, setContractBalanceRaw] = useState<number>(0);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isLoadingSpins, setIsLoadingSpins] = useState(false);
  const [spinsError, setSpinsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLowLiquidity, setIsLowLiquidity] = useState(false);

  const arcReadProvider = useMemo(() => new JsonRpcProvider(ARC_TESTNET.rpcUrl, undefined, { staticNetwork: true }), []);

  const checkNetwork = useCallback(async () => {
    if (!window.ethereum) return false;
    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
      const isArc = parseInt(chainId, 16) === ARC_TESTNET.chainId;
      setIsOnArcNetwork(isArc);
      return isArc;
    } catch {
      return false;
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!provider || !address || !isOnArcNetwork) return;
    try {
      const contract = new Contract(USDC_ADDRESS, USDC_ABI, provider);
      const balance = await contract.balanceOf(address);
      setWalletBalance(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [provider, address, isOnArcNetwork]);

  const fetchSpinsLeft = useCallback(async () => {
    if (!address) return;
    setIsLoadingSpins(true);
    setSpinsError(null);
    try {
      const contract = new Contract(SPIN_CONTRACT_ADDRESS, SPIN_CONTRACT_ABI, arcReadProvider);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 15000)
      );
      const spins = await Promise.race([
        contract.spinsLeft(address),
        timeoutPromise
      ]) as bigint;
      setSpinsLeft(Number(spins));
      setSpinsError(null);
    } catch (error) {
      console.error("Error fetching spins left:", error);
      setSpinsError("Failed to load spins from contract");
    } finally {
      setIsLoadingSpins(false);
    }
  }, [address, arcReadProvider]);

  const fetchContractBalance = useCallback(async () => {
    try {
      const contract = new Contract(USDC_ADDRESS, USDC_ABI, arcReadProvider);
      const balance = await contract.balanceOf(SPIN_CONTRACT_ADDRESS);
      const balanceNumber = parseFloat(formatUnits(balance, 6));
      setContractBalanceRaw(balanceNumber);
      setContractBalance(balanceNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setIsLowLiquidity(balanceNumber < MIN_CONTRACT_BALANCE);
    } catch (error) {
      console.error("Error fetching contract balance:", error);
    }
  }, [arcReadProvider]);

  const fetchNextReset = useCallback(async () => {
    if (!address) return;
    try {
      const contract = new Contract(SPIN_CONTRACT_ADDRESS, SPIN_CONTRACT_ABI, arcReadProvider);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 15000)
      );
      const resetTime = await Promise.race([
        contract.nextReset(address),
        timeoutPromise
      ]) as bigint;
      setNextResetTime(Number(resetTime));
    } catch (error) {
      console.error("Error fetching next reset:", error);
    }
  }, [address, arcReadProvider]);

  const refreshAllData = useCallback(async () => {
    if (!address) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchSpinsLeft(),
        fetchNextReset(),
        fetchContractBalance(),
        fetchBalance()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [address, fetchSpinsLeft, fetchNextReset, fetchContractBalance, fetchBalance]);

  useEffect(() => {
    if (spinsLeft !== null && spinsLeft === 0 && nextResetTime > 0) {
      let hasTriggeredRefresh = false;
      
      const calculateCountdown = () => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = nextResetTime - now;
        
        if (remaining <= 0) {
          setCountdown(null);
          if (!hasTriggeredRefresh && address) {
            hasTriggeredRefresh = true;
            fetchSpinsLeft();
            fetchNextReset();
          }
          return;
        }
        
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        setCountdown({ hours, minutes, seconds });
      };
      
      calculateCountdown();
      const interval = setInterval(calculateCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [spinsLeft, nextResetTime, address, fetchSpinsLeft, fetchNextReset]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        variant: "destructive",
        title: "Wallet Not Found",
        description: "Please install MetaMask or Rabby wallet.",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        setProvider(browserProvider);
        
        const isArc = await checkNetwork();
        if (!isArc) {
          await switchToArcNetwork();
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setIsConnected(false);
    setProvider(null);
    setWalletBalance(undefined);
    setSpinsLeft(null);
    setIsOnArcNetwork(false);
    setNextResetTime(0);
    setCountdown(null);
  };

  const switchToArcNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    
    setIsSwitchingNetwork(true);
    
    const addArcNetwork = async () => {
      await window.ethereum!.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: ARC_TESTNET.chainIdHex,
          chainName: ARC_TESTNET.name,
          nativeCurrency: ARC_TESTNET.nativeCurrency,
          rpcUrls: [ARC_TESTNET.rpcUrl],
          blockExplorerUrls: [ARC_TESTNET.explorer],
        }],
      });
    };
    
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET.chainIdHex }],
      });
      setIsOnArcNetwork(true);
      toast({
        title: "Network Changed",
        description: "Switched to Arc Testnet successfully.",
      });
    } catch (switchError: any) {
      console.log("Switch error:", switchError);
      const errorCode = switchError?.code || switchError?.error?.code;
      
      if (errorCode === 4902 || errorCode === -32603 || !errorCode) {
        try {
          await addArcNetwork();
          setIsOnArcNetwork(true);
          toast({
            title: "Network Added",
            description: "Arc Testnet has been added and connected.",
          });
        } catch (addError: any) {
          console.log("Add error:", addError);
          if (addError?.code === 4001) {
            toast({
              variant: "destructive",
              title: "Request Rejected",
              description: "You rejected the network addition request.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Failed to Add Network",
              description: addError.message || "Please add Arc Testnet manually.",
            });
          }
        }
      } else if (errorCode === 4001) {
        toast({
          variant: "destructive",
          title: "Request Rejected",
          description: "You rejected the network switch request.",
        });
      } else {
        try {
          await addArcNetwork();
          setIsOnArcNetwork(true);
          toast({
            title: "Network Added",
            description: "Arc Testnet has been added and connected.",
          });
        } catch (addError: any) {
          console.log("Fallback add error:", addError);
          toast({
            variant: "destructive",
            title: "Network Switch Failed",
            description: "Please switch to Arc Testnet manually in your wallet.",
          });
        }
      }
    } finally {
      setIsSwitchingNetwork(false);
    }
  }, []);

  const handleSpin = async () => {
    if (!provider || !address || isWaitingForBlockchain || isAnimating || spinsLeft === null || spinsLeft <= 0 || isLowLiquidity) return;

    setIsWaitingForBlockchain(true);
    setSpinStatus("Confirm in wallet...");
    
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(SPIN_CONTRACT_ADDRESS, SPIN_CONTRACT_ABI, signer);
      
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const randomNumber = BigInt("0x" + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      toast({
        title: "Confirm Transaction",
        description: "Please confirm the transaction in your wallet.",
      });

      const tx = await contract.spin(randomNumber);
      
      setSpinStatus("Waiting for blockchain result...");
      
      toast({
        title: "Transaction Sent",
        description: "Waiting for blockchain confirmation...",
      });

      const receipt = await tx.wait();
      
      let rewardAmount = BigInt(0);
      let eventFound = false;
      
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed && parsed.name === "SpinPlayed") {
            const eventPlayer = parsed.args.player?.toLowerCase();
            if (eventPlayer === address.toLowerCase()) {
              rewardAmount = parsed.args.reward;
              eventFound = true;
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (!eventFound) {
        throw new Error("SpinPlayed event not found for your wallet");
      }

      setIsWaitingForBlockchain(false);
      setIsAnimating(true);
      setSpinStatus("Spinning...");

      const targetIndex = getPrizeIndexByBigInt(rewardAmount);
      const rewardValue = Number(rewardAmount / BigInt(1000000));
      
      const segmentAngle = 360 / prizes.length;
      const minSpins = 5;
      const maxSpins = 8;
      const spins = minSpins + Math.random() * (maxSpins - minSpins);
      const targetAngle = 360 - (targetIndex * segmentAngle) - (segmentAngle / 2);
      const totalRotation = spins * 360 + targetAngle;
      
      setRotation(prev => prev + totalRotation);
      setLastWinAmount(rewardValue);
      setLastTxHash(receipt.hash);

      try {
        await fetch("/api/spin-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            reward: rewardValue,
            transactionHash: receipt.hash
          })
        });
      } catch (e) {
        console.warn("Failed to log spin result:", e);
      }

      setTimeout(() => {
        setIsAnimating(false);
        setSpinStatus("");
        const prize = prizes[targetIndex];
        setWonPrize(prize);
        setShowWinDialog(true);
        
        fetchBalance();
        fetchSpinsLeft();
        fetchContractBalance();
        fetchNextReset();
      }, 10000);

    } catch (error: any) {
      setIsWaitingForBlockchain(false);
      setIsAnimating(false);
      setSpinStatus("");
      
      if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        toast({
          variant: "destructive",
          title: "Transaction Cancelled",
          description: "You cancelled the transaction.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Spin Failed",
          description: error.reason || error.message || "Transaction failed. Please try again.",
        });
      }
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      try {
        const accounts = args[0] as string[];
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAddress(accounts[0]);
        }
      } catch (e) {
        console.warn("Error handling account change:", e);
      }
    };

    const handleChainChanged = () => {
      try {
        checkNetwork();
        if (provider && address) {
          fetchBalance();
          fetchSpinsLeft();
        }
      } catch (e) {
        console.warn("Error handling chain change:", e);
      }
    };

    try {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    } catch (e) {
      console.warn("Error setting up wallet listeners:", e);
    }

    return () => {
      try {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum?.removeListener("chainChanged", handleChainChanged);
      } catch (e) {
        console.warn("Error removing wallet listeners:", e);
      }
    };
  }, [provider, address, checkNetwork, fetchBalance, fetchSpinsLeft]);

  useEffect(() => {
    if (address) {
      fetchSpinsLeft();
      fetchNextReset();
    }
  }, [address, fetchSpinsLeft, fetchNextReset]);

  useEffect(() => {
    if (spinsError && address && !isLoadingSpins) {
      const retryTimeout = setTimeout(() => {
        console.log("Auto-retrying to fetch spins...");
        fetchSpinsLeft();
      }, 5000);
      return () => clearTimeout(retryTimeout);
    }
  }, [spinsError, address, isLoadingSpins, fetchSpinsLeft]);

  useEffect(() => {
    if (isConnected && isOnArcNetwork) {
      fetchBalance();
    }
  }, [isConnected, isOnArcNetwork, fetchBalance]);

  const [hasAttemptedSwitch, setHasAttemptedSwitch] = useState(false);
  
  useEffect(() => {
    if (isConnected && !isOnArcNetwork && !isSwitchingNetwork && !hasAttemptedSwitch) {
      setHasAttemptedSwitch(true);
      switchToArcNetwork();
    }
    if (isOnArcNetwork) {
      setHasAttemptedSwitch(false);
    }
  }, [isConnected, isOnArcNetwork, isSwitchingNetwork, hasAttemptedSwitch, switchToArcNetwork]);

  useEffect(() => {
    fetchContractBalance();
    const interval = setInterval(fetchContractBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchContractBalance]);

  useEffect(() => {
    const autoConnectAndSwitchNetwork = async () => {
      if (!window.ethereum) return;
      
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
        
        if (accounts.length > 0) {
          const browserProvider = new BrowserProvider(window.ethereum);
          setAddress(accounts[0]);
          setIsConnected(true);
          setProvider(browserProvider);
          
          const chainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
          const isArc = parseInt(chainId, 16) === ARC_TESTNET.chainId;
          setIsOnArcNetwork(isArc);
        }
      } catch (e) {
        console.warn("Auto-connect failed:", e);
      }
    };

    autoConnectAndSwitchNetwork();
  }, []);

  const isSpinBusy = isWaitingForBlockchain || isAnimating;
  const canSpin = isConnected && isOnArcNetwork && spinsLeft !== null && spinsLeft > 0 && !isSpinBusy && !isLoadingSpins && !spinsError && !isLowLiquidity;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 relative overflow-hidden">
      <Toaster />
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />
      
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center border border-yellow-500/50 shadow-lg">
              <Gift className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-app-title">Arc Spin Lottery</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Win Free USDC</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-card border border-border rounded-md px-4 py-2">
                  <div className={`w-2 h-2 rounded-full ${isOnArcNetwork ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium font-mono" data-testid="text-wallet-address">{shortenAddress(address)}</span>
                    <Badge variant={isOnArcNetwork ? "outline" : "destructive"} className="text-xs px-1 py-0 h-4 w-fit" data-testid="badge-network">
                      {isOnArcNetwork ? "Arc Testnet" : "Wrong Network"}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={disconnectWallet} className="h-6 ml-2 text-xs" data-testid="button-disconnect">
                    Disconnect
                  </Button>
                </div>
                {isOnArcNetwork && walletBalance !== undefined && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground">My Balance</span>
                    <span className="text-sm font-bold text-green-500 font-mono" data-testid="text-wallet-usdc-balance">
                      {formatUSDC(walletBalance)} USDC
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Button 
                onClick={connectWallet} 
                disabled={isConnecting}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold" 
                data-testid="button-connect"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4 mr-2" />
                )}
                Connect Wallet
              </Button>
            )}
          </div>
        </header>

        {!isConnected && (
          <div className="space-y-8">
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center space-y-8">
              <div className="relative">
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center border border-yellow-500/50 shadow-2xl">
                  <Trophy className="w-14 h-14 text-black" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-pulse" />
              </div>
              <div className="space-y-3 max-w-md">
                <h2 className="text-4xl font-bold tracking-tight">Spin to Win USDC!</h2>
                <p className="text-muted-foreground text-lg">Connect your wallet to spin the wheel and win up to 1000 USDC on Arc Testnet.</p>
              </div>
              <Button 
                onClick={connectWallet}
                disabled={isConnecting}
                size="lg"
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold px-8"
                data-testid="button-connect-hero"
              >
                {isConnecting ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Wallet className="w-5 h-5 mr-2" />
                )}
                Connect Wallet to Play
              </Button>
              
              <Card className="bg-card/50 backdrop-blur-sm border-yellow-500/20 max-w-md w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-yellow-500" /> Prize Pool
                    </div>
                    <Badge variant="outline" className="text-green-500 border-green-500/50" data-testid="badge-contract-balance">
                      {contractBalance} USDC
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">1000 USDC</span><span className="text-yellow-500 font-bold">2%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">200 USDC</span><span className="text-purple-500 font-bold">3%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">100 USDC</span><span className="text-pink-500 font-bold">10%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">50 USDC</span><span className="text-amber-500 font-bold">5%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">20 USDC</span><span className="text-cyan-500 font-bold">~5%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">10 USDC</span><span className="text-blue-500 font-bold">10%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">5 USDC</span><span className="text-green-500 font-bold">15%</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {isConnected && (
          <>
            {!isOnArcNetwork && (
              <Alert className="bg-orange-500/10 border-orange-500/50">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <AlertTitle className="text-orange-500">Wrong Network</AlertTitle>
                <AlertDescription className="text-orange-400">
                  <p className="mb-2">You are not connected to Arc Testnet. Please switch networks to play.</p>
                  <Button 
                    onClick={switchToArcNetwork} 
                    disabled={isSwitchingNetwork}
                    variant="outline"
                    size="sm"
                    className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                    data-testid="button-switch-network"
                  >
                    {isSwitchingNetwork ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Switching...
                      </>
                    ) : (
                      "Switch to Arc Testnet"
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isOnArcNetwork && (
              <>
                {isLowLiquidity && (
                  <Alert className="bg-red-500/10 border-red-500/50">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <AlertTitle className="text-red-500">Low Liquidity</AlertTitle>
                    <AlertDescription className="text-red-400">
                      Spin temporarily disabled due to low liquidity. The contract needs at least {MIN_CONTRACT_BALANCE} USDC to operate.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col md:flex-row justify-center gap-4">
                  <Card className="bg-card/50 backdrop-blur-sm border-yellow-500/20 w-full max-w-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                        <Gift className="w-4 h-4" /> Contract Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${isLowLiquidity ? 'text-red-500' : 'text-green-500'}`} data-testid="text-contract-balance">
                          {contractBalance} USDC
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Available Prize Pool</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 backdrop-blur-sm border-yellow-500/20 w-full max-w-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                        <RotateCcw className="w-4 h-4" /> Spins Left Today
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={refreshAllData}
                          disabled={isRefreshing || isLoadingSpins}
                          className="ml-2"
                          data-testid="button-refresh"
                        >
                          <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        {spinsError ? (
                          <div className="space-y-2">
                            <div className="text-red-500 flex items-center justify-center gap-2" data-testid="text-spins-error">
                              <AlertCircle className="w-5 h-5" />
                              <span className="text-sm">Failed to load from contract</span>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={refreshAllData}
                              disabled={isRefreshing}
                              data-testid="button-retry"
                            >
                              {isRefreshing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Retrying...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Retry
                                </>
                              )}
                            </Button>
                          </div>
                        ) : isLoadingSpins ? (
                          <div className="text-muted-foreground flex items-center justify-center gap-2" data-testid="text-spins-loading">
                            <Loader2 className="w-6 h-6 animate-spin" /> Loading from contract...
                          </div>
                        ) : spinsLeft !== null ? (
                          <>
                            <div className="text-4xl font-bold" data-testid="text-spins-left">
                              <span className={spinsLeft > 0 ? "text-green-500" : "text-red-500"}>{spinsLeft}</span>
                              <span className="text-muted-foreground"> / {MAX_SPINS_PER_DAY}</span>
                            </div>
                            {spinsLeft === 0 && (
                              <p className="text-xs text-muted-foreground mt-2">Come back tomorrow for more spins!</p>
                            )}
                          </>
                        ) : (
                          <div className="text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin" /> Loading...
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {spinsLeft === 0 && (
                  <Alert className="bg-red-500/10 border-red-500/50">
                    <Clock className="h-4 w-4 text-red-500" />
                    <AlertTitle className="text-red-500">Daily Limit Reached</AlertTitle>
                    <AlertDescription className="text-red-400">
                      <p className="mb-3">You have used all {MAX_SPINS_PER_DAY} spins for today.</p>
                      {countdown && (
                        <div className="flex items-center gap-2">
                          <span>Next spins available in:</span>
                          <div className="flex gap-1 font-mono text-lg font-bold text-red-500" data-testid="text-countdown">
                            <div className="bg-red-500/20 rounded px-2 py-1">
                              {String(countdown.hours).padStart(2, '0')}
                            </div>
                            <span className="text-red-400">:</span>
                            <div className="bg-red-500/20 rounded px-2 py-1">
                              {String(countdown.minutes).padStart(2, '0')}
                            </div>
                            <span className="text-red-400">:</span>
                            <div className="bg-red-500/20 rounded px-2 py-1">
                              {String(countdown.seconds).padStart(2, '0')}
                            </div>
                          </div>
                        </div>
                      )}
                      {!countdown && (
                        <p>Come back tomorrow for more spins!</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col items-center py-8">
                  <Card className="bg-card/50 backdrop-blur-sm border-yellow-500/20 p-8 w-full max-w-lg">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold mb-2">Spin to Win!</h2>
                      <p className="text-muted-foreground text-sm">Try your luck and win USDC prizes instantly</p>
                    </div>
                    
                    <LotteryWheel 
                      onSpin={handleSpin}
                      disabled={!canSpin}
                      isWaitingForBlockchain={isWaitingForBlockchain}
                      isAnimating={isAnimating}
                      spinStatus={spinStatus}
                      targetPrizeIndex={null}
                      rotation={rotation}
                    />

                    {!canSpin && !isSpinBusy && isOnArcNetwork && spinsLeft === 0 && (
                      <p className="text-center text-sm text-muted-foreground mt-6">
                        Come back tomorrow for more spins!
                      </p>
                    )}
                    {isLowLiquidity && (
                      <p className="text-center text-sm text-red-400 mt-6">
                        Spin disabled due to low contract liquidity.
                      </p>
                    )}
                  </Card>
                </div>
              </>
            )}
          </>
        )}

        <footer className="border-t border-border/40 pt-6 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Gift className="w-4 h-4" />
              <span>Arc Spin Lottery - Testnet Only</span>
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
              Contract: <a href={`${ARC_TESTNET.explorer}/address/${SPIN_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-foreground transition-colors">{SPIN_CONTRACT_ADDRESS}</a>
            </p>
          </div>
        </footer>
      </div>

      <Dialog open={showWinDialog} onOpenChange={setShowWinDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-3 text-3xl">
              {wonPrize && wonPrize.value > 0 ? (
                <>
                  <PartyPopper className="w-8 h-8 text-yellow-500 animate-bounce" />
                  <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                    Congratulations!
                  </span>
                  <PartyPopper className="w-8 h-8 text-yellow-500 animate-bounce" />
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-muted-foreground" />
                  Better Luck Next Time!
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-8">
            {wonPrize && wonPrize.value > 0 ? (
              <>
                <div className="relative">
                  <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-pulse" 
                       style={{ backgroundColor: wonPrize.color, boxShadow: `0 0 40px ${wonPrize.color}50` }}>
                    <Trophy className="w-16 h-16 text-white drop-shadow-lg" />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '2s' }} />
                </div>
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground text-lg">You won</p>
                  <div className="text-5xl font-bold text-green-500 animate-pulse" data-testid="text-won-amount">
                    {lastWinAmount} USDC
                  </div>
                  <p className="text-muted-foreground">
                    Your reward has been sent to your wallet!
                  </p>
                  {lastTxHash && (
                    <a 
                      href={`${ARC_TESTNET.explorer}/tx/${lastTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                      data-testid="link-tx-hash"
                    >
                      View Transaction on Explorer
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-4 bg-muted">
                  <AlertCircle className="w-12 h-12 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-center">
                  You didn't win this time. Keep spinning for a chance to win USDC!
                </p>
              </>
            )}
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:flex-col">
            <Button 
              onClick={() => {
                setShowWinDialog(false);
                setWonPrize(null);
              }}
              variant="default"
              className="w-full"
              data-testid="button-close-dialog"
            >
              {spinsLeft !== null && spinsLeft > 0 ? "Spin Again!" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
