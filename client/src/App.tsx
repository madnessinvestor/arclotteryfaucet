import { useState, useEffect, useCallback, useMemo } from "react";
import { BrowserProvider, Contract, formatUnits, JsonRpcProvider } from "ethers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Gift, AlertCircle, AlertTriangle, Clock, Trophy, Sparkles, PartyPopper, Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
import { Toaster } from "@/components/ui/toaster";
import { LotteryWheel, prizes, getPrizeIndexByRoll, type Prize } from "./components/LotteryWheel";
import { 
  SPIN_CONTRACT_ADDRESS, 
  USDC_ADDRESS, 
  ARC_TESTNET, 
  SPIN_CONTRACT_ABI, 
  USDC_ABI, 
  MAX_SPINS_PER_DAY,
  MIN_CONTRACT_BALANCE
} from "./config";
import { SiX, SiGithub, SiTelegram, SiDiscord, SiYoutube, SiFarcaster, SiInstagram } from "react-icons/si";

const formatUSDC = (value: bigint | undefined) => {
  if (!value) return "0.00";
  return parseFloat(formatUnits(value, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function App() {
  const { playAudio } = useAudio();
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
  const [audioTriggered, setAudioTriggered] = useState(false);

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
      // Convert relative seconds to absolute timestamp
      setNextResetTime(Math.floor(Date.now() / 1000) + Number(resetTime));
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
    if (nextResetTime > 0) {
      let hasTriggeredRefresh = false;
      
      const calculateCountdown = () => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = nextResetTime - now;
        
        if (remaining <= 0) {
          setCountdown(null);
          if (!hasTriggeredRefresh && address) {
            hasTriggeredRefresh = true;
            refreshAllData();
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
  }, [nextResetTime, address, refreshAllData]);

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

      // setRotation(prev => prev + 360); // Removed to sync with contract result

      const tx = await contract.spin(randomNumber);
      
      setSpinStatus("Waiting for blockchain result...");
      
      toast({
        title: "Transaction Sent",
        description: "Waiting for blockchain confirmation...",
      });

      const receipt = await tx.wait();
      
      let rewardAmount = BigInt(0);
      let eventRandom = BigInt(0);
      let eventFound = false;
      
      // Find SpinPlayed event in logs
      for (const log of receipt.logs) {
        try {
          if (log.address.toLowerCase() !== SPIN_CONTRACT_ADDRESS.toLowerCase()) {
            continue;
          }
          
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          
          if (parsed && parsed.name === "SpinPlayed") {
            const eventPlayer = parsed.args.player?.toLowerCase();
            const userAddress = address.toLowerCase();
            
            if (eventPlayer === userAddress) {
              rewardAmount = parsed.args.reward;
              eventRandom = parsed.args.random;
              eventFound = true;
              break;
            }
          }
        } catch (parseError) {
          continue;
        }
      }

      if (!eventFound) {
        throw new Error("SpinPlayed event not found for your wallet");
      }

      // 1. First set state that we got the result
      setIsWaitingForBlockchain(false);
      
      // 2. IDENTIFY THE PRIZE (using EXCLUSIVE mapping from SpinPlayed event)
      // ✅ ESPECIFICAÇÃO TÉCNICA: Mapear o reward do evento para o índice exato da roleta
      // 🚨 Nenhuma lógica auxiliar, apenas evento SpinPlayed é verdade
      // USDC on Arc Testnet has 6 decimals, but if the value is coming in as 18 decimals equivalent 
      // because of a contract bug or ethers default parsing, we need to handle it.
      // Based on user report: 20,000,000,000,000,000,000 raw = 20 USDC. 
      // That means raw is in 18 decimals, while USDC should be 6. 
      // 20 * 10^18 / 10^12 = 20 * 10^6.
      // So if we divide by 10^18 we get 20.
      const rewardValue = Number(rewardAmount / BigInt("1000000000000000000"));
      const roll = Number(eventRandom % BigInt(100));
      
      // Mandatory Log for Validation
      console.log({
        eventReward: rewardAmount.toString(),
        eventRandom: eventRandom.toString(),
        roll: roll.toString(),
        rewardValue: rewardValue
      });
      
      // Determine target index from roll (ONLY for visual positioning)
      // But rewardValue is the absolute source of truth for display
      const targetIndex = getPrizeIndexByRoll(roll);
      
      console.log(`✅ SpinPlayed Event: ${rewardValue.toLocaleString('en-US')} USDC (Roll: ${roll}) → Index ${targetIndex}`);
      
      // Play "prêmio encontrado" sound as soon as prize is identified
      playAudio("found");
      
      // 3. START THE ANIMATION NOW
      setIsAnimating(true);
      setAudioTriggered(true);
      setSpinStatus("Spinning...");
      
      // Play spin sound immediately
      playAudio("spin");

      const segmentAngle = 360 / prizes.length;
      const minSpins = 5;
      const maxSpins = 8;
      const spins = Math.floor(minSpins + Math.random() * (maxSpins - minSpins));
      
      // Calculate rotation to land exactly on the segment
      // CSS rotation is clockwise, segments are mapped counter-clockwise from top (-90deg)
      // Pointer is at the top (0 degrees).
      // Segment 0 (1000 USDC) starts at -90deg and ends at -90 + angle.
      // To align the middle of segment targetIndex with the top pointer:
      // We need to rotate the wheel by: 360 - (targetIndex * angle + angle/2)
      // because 0deg rotation in CSS aligns the start of the first segment (-90deg offset)
      // to the 3 o'clock position usually, but we need the pointer at 12 o'clock.
      const targetAngle = 360 - (targetIndex * segmentAngle + segmentAngle / 2);
      
      const currentRotationMod = rotation % 360;
      let additionalRotation = (targetAngle - currentRotationMod + 720) % 360;
      
      // Ensure it lands exactly
      const totalRotation = (spins * 360) + additionalRotation;
      
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

      // Wait for animation to finish + 5 extra seconds as requested
      // The CSS transition is 10s
      setTimeout(() => {
        setIsAnimating(false);
        setSpinStatus("");
        const prize = prizes[targetIndex];
        setWonPrize(prize);
        setShowWinDialog(true);
        
        // Play win or loss sound based on reward
        if (rewardValue > 0) {
          playAudio("win");
        } else {
          playAudio("loss");
        }
        
        toast({
          title: rewardValue > 0 ? "Congratulations!" : "Better Luck Next Time!",
          description: rewardValue > 0 
            ? `You won ${rewardValue.toLocaleString('en-US')} USDC!` 
            : "Keep spinning for a chance to win!",
        });
        
        fetchBalance();
        fetchSpinsLeft();
        fetchContractBalance();
        fetchNextReset();
      }, 15000); // 10s animation + 5s wait

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
      
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
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
                    <div className="flex justify-between"><span className="text-muted-foreground">50 USDC</span><span className="text-amber-500 font-bold">10%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">20 USDC</span><span className="text-cyan-500 font-bold">20%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">10 USDC</span><span className="text-blue-500 font-bold">15%</span></div>
                    <div className="flex justify-between col-span-2"><span className="text-muted-foreground">0 USDC</span><span className="text-gray-500 font-bold">40%</span></div>
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
                            {spinsLeft === 0 && !countdown && (
                              <p className="text-xs text-green-500 mt-2 font-bold uppercase tracking-wider">20 spins available</p>
                            )}
                            {spinsLeft === 0 && countdown && (
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
                  <div className="flex justify-center">
                    <Alert className="bg-red-500/10 border-red-500/50 max-w-sm">
                      <Clock className="h-4 w-4 text-red-500" />
                      <AlertTitle className="text-red-500">Daily Limit Reached</AlertTitle>
                      <AlertDescription className="text-red-400 text-center">
                        <p className="mb-3">You have used all {MAX_SPINS_PER_DAY} spins for today.</p>
                        {countdown && (
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-muted-foreground font-medium">Reset in:</span>
                            <div className="flex gap-2 font-mono text-3xl font-bold text-yellow-500" data-testid="text-countdown">
                              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 min-w-[3.5rem] text-center">
                                {String(countdown.hours).padStart(2, '0')}
                              </div>
                              <span className="text-yellow-500/50 self-center">:</span>
                              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 min-w-[3.5rem] text-center">
                                {String(countdown.minutes).padStart(2, '0')}
                              </div>
                              <span className="text-yellow-500/50 self-center">:</span>
                              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 min-w-[3.5rem] text-center">
                                {String(countdown.seconds).padStart(2, '0')}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Next 20 spins available after reset</p>
                          </div>
                        )}
                        {!countdown && (
                          <p>Come back tomorrow for more spins!</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                <div className="flex flex-col items-center py-8">
                  <Card className="bg-card/50 backdrop-blur-sm border-yellow-500/20 p-12 py-24 w-full max-w-4xl shadow-[0_0_50px_rgba(234,179,8,0.1)]">
                    <div className="text-center mb-16">
                      <h2 className="text-5xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent tracking-tight">Spin to Win!</h2>
                    </div>
                    
                    <div className="scale-110 md:scale-125 origin-center py-10">
                      <LotteryWheel 
                        onSpin={handleSpin}
                        disabled={!canSpin}
                        isWaitingForBlockchain={isWaitingForBlockchain}
                        isAnimating={isAnimating}
                        spinStatus={spinStatus}
                        targetPrizeIndex={null}
                        rotation={rotation}
                      />
                    </div>

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

        <footer className="mt-12 py-8 border-t border-border/40 text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-bold tracking-tight text-white font-mono">Arc Spin Lottery</h2>
            <div className="flex items-center justify-center gap-6">
              <a href="https://x.com/madnessinvestor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-x">
                <SiX className="w-6 h-6" />
              </a>
              <a href="https://github.com/madnessinvestor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-github">
                <SiGithub className="w-6 h-6" />
              </a>
              <a href="https://www.youtube.com/@madnessinvestor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-youtube">
                <SiYoutube className="w-6 h-6" />
              </a>
              <a href="https://farcaster.xyz/madnessinvestor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-farcaster">
                <SiFarcaster className="w-6 h-6" />
              </a>
              <a href="https://www.instagram.com/madnessinvestor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-instagram">
                <SiInstagram className="w-6 h-6" />
              </a>
              <a href="https://web.telegram.org/k/#@madnessinvestor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-telegram">
                <SiTelegram className="w-6 h-6" />
              </a>
              <a href="https://discord.com/users/madnessinvestor" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-social-discord">
                <SiDiscord className="w-6 h-6" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              2025 Arc Spin Lottery - Built on Arc Network. All rights reserved.
            </p>
          </div>
          <div className="text-center mt-4">
            <p className="text-[10px] text-muted-foreground/50">
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
                  Better luck next time!
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
                    {lastWinAmount.toLocaleString('en-US')} USDC
                  </div>
                  <p className="text-muted-foreground">
                    Your reward has been sent directly to your wallet!
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
              className="w-full bg-yellow-500 text-black hover:bg-yellow-400 font-bold"
              data-testid="button-close-dialog"
            >
              {spinsLeft !== null && spinsLeft > 0 ? "SPIN AGAIN!" : "CLOSE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
