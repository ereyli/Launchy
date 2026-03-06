import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Coins, Image as ImageIcon, Check, Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function CreateProject() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialType = searchParams.get("type") || "token";
  const [projectType, setProjectType] = useState<"token" | "nft">(
    initialType === "nft" ? "nft" : "token"
  );
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deploymentData, setDeploymentData] = useState({
    txHash: "0x1234567890abcdef...",
    address: "0xabcdef1234567890...",
  });

  // Token form data
  const [tokenForm, setTokenForm] = useState({
    name: "",
    symbol: "",
    description: "",
    supply: "",
    marketCap: "",
    logoUrl: "",
  });

  // NFT form data
  const [nftForm, setNftForm] = useState({
    name: "",
    description: "",
    maxSupply: "",
    mintModel: "free",
    mintPrice: "",
    perWalletLimit: "",
    imageUrl: "",
  });

  const tokenSteps = ["Basics", "Economics", "Branding", "Review", "Deploy"];
  const nftSteps = ["Basics", "Supply & Model", "Media", "Review", "Deploy"];
  const steps = projectType === "token" ? tokenSteps : nftSteps;
  const progress = (step / steps.length) * 100;

  const handleDeploy = async () => {
    setIsDeploying(true);
    // Simulate deployment
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setIsDeploying(false);
    setShowSuccess(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  useEffect(() => {
    setStep(1);
  }, [projectType]);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2">Create New Project</h1>
          <p className="text-muted-foreground">
            Launch your {projectType === "token" ? "token" : "NFT collection"} on Starknet
          </p>
        </div>

        {/* Project Type Selector */}
        <Tabs value={projectType} onValueChange={(v) => setProjectType(v as "token" | "nft")} className="mb-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="token" className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Token
            </TabsTrigger>
            <TabsTrigger value="nft" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              NFT Collection
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Progress */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Step {step} of {steps.length}</span>
                <span className="font-medium">{steps[step - 1]}</span>
              </div>
              <Progress value={progress} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {steps.map((s, i) => (
                <Badge
                  key={i}
                  variant={i + 1 === step ? "default" : i + 1 < step ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {i + 1 < step && <Check className="w-3 h-3 mr-1" />}
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Token Wizard */}
        {projectType === "token" && (
          <Card>
            <CardHeader>
              <CardTitle>{steps[step - 1]}</CardTitle>
              <CardDescription>
                {step === 1 && "Enter the basic details of your token"}
                {step === 2 && "Configure token economics and supply"}
                {step === 3 && "Add branding and visual identity"}
                {step === 4 && "Review your token configuration"}
                {step === 5 && "Deploy your token to Starknet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="token-name">Token Name</Label>
                    <Input
                      id="token-name"
                      placeholder="e.g., My Token"
                      value={tokenForm.name}
                      onChange={(e) => setTokenForm({ ...tokenForm, name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      The full name of your token
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-symbol">Symbol</Label>
                    <Input
                      id="token-symbol"
                      placeholder="e.g., MTK"
                      value={tokenForm.symbol}
                      onChange={(e) => setTokenForm({ ...tokenForm, symbol: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      3-5 character ticker symbol
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-description">Description</Label>
                    <Textarea
                      id="token-description"
                      placeholder="Describe your token..."
                      rows={4}
                      value={tokenForm.description}
                      onChange={(e) => setTokenForm({ ...tokenForm, description: e.target.value })}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="token-supply">Total Supply</Label>
                    <Input
                      id="token-supply"
                      type="number"
                      placeholder="1000000"
                      value={tokenForm.supply}
                      onChange={(e) => setTokenForm({ ...tokenForm, supply: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Market Cap Preset</Label>
                    <div className="flex gap-2 flex-wrap">
                      {["$10K", "$50K", "$100K", "$500K", "$1M"].map((cap) => (
                        <Button
                          key={cap}
                          variant="outline"
                          size="sm"
                          onClick={() => setTokenForm({ ...tokenForm, marketCap: cap })}
                        >
                          {cap}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-marketcap">Custom Market Cap</Label>
                    <Input
                      id="token-marketcap"
                      placeholder="Enter custom amount"
                      value={tokenForm.marketCap}
                      onChange={(e) => setTokenForm({ ...tokenForm, marketCap: e.target.value })}
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="token-logo">Logo URL</Label>
                    <Input
                      id="token-logo"
                      placeholder="https://..."
                      value={tokenForm.logoUrl}
                      onChange={(e) => setTokenForm({ ...tokenForm, logoUrl: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload your token logo (PNG, JPG, or SVG)
                    </p>
                  </div>
                  {tokenForm.logoUrl && (
                    <div className="border border-border rounded-lg p-4 flex items-center justify-center">
                      <img
                        src={tokenForm.logoUrl}
                        alt="Token logo preview"
                        className="w-24 h-24 rounded-full object-cover"
                      />
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Name</p>
                      <p className="font-medium">{tokenForm.name || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Symbol</p>
                      <p className="font-medium">{tokenForm.symbol || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Supply</p>
                      <p className="font-medium">{tokenForm.supply || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Market Cap</p>
                      <p className="font-medium">{tokenForm.marketCap || "Not set"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p>{tokenForm.description || "Not set"}</p>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Coins className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="mb-2">Ready to Deploy</h3>
                  <p className="text-muted-foreground mb-6">
                    Your token configuration is complete. Click deploy to launch on Starknet.
                  </p>
                  <Button size="lg" onClick={handleDeploy} disabled={isDeploying}>
                    {isDeploying ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      "Deploy Token"
                    )}
                  </Button>
                </div>
              )}

              {/* Navigation */}
              {step < 5 && (
                <div className="flex gap-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    disabled={step === 1}
                    className="flex-1"
                  >
                    Previous
                  </Button>
                  <Button onClick={() => setStep(step + 1)} className="flex-1">
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* NFT Wizard */}
        {projectType === "nft" && (
          <Card>
            <CardHeader>
              <CardTitle>{steps[step - 1]}</CardTitle>
              <CardDescription>
                {step === 1 && "Enter the basic details of your NFT collection"}
                {step === 2 && "Configure supply and mint model"}
                {step === 3 && "Upload collection artwork"}
                {step === 4 && "Review your collection configuration"}
                {step === 5 && "Deploy your collection to Starknet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nft-name">Collection Name</Label>
                    <Input
                      id="nft-name"
                      placeholder="e.g., My NFT Collection"
                      value={nftForm.name}
                      onChange={(e) => setNftForm({ ...nftForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nft-description">Description</Label>
                    <Textarea
                      id="nft-description"
                      placeholder="Describe your collection..."
                      rows={4}
                      value={nftForm.description}
                      onChange={(e) => setNftForm({ ...nftForm, description: e.target.value })}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nft-supply">Max Supply</Label>
                    <Input
                      id="nft-supply"
                      type="number"
                      placeholder="10000"
                      value={nftForm.maxSupply}
                      onChange={(e) => setNftForm({ ...nftForm, maxSupply: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of NFTs in this collection
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Mint Model</Label>
                    <RadioGroup
                      value={nftForm.mintModel}
                      onValueChange={(v) => setNftForm({ ...nftForm, mintModel: v })}
                    >
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-4">
                        <RadioGroupItem value="free" id="free" />
                        <Label htmlFor="free" className="flex-1 cursor-pointer">
                          <div>
                            <p className="font-medium">Free Mint</p>
                            <p className="text-sm text-muted-foreground">
                              Gasless minting for your community
                            </p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-4">
                        <RadioGroupItem value="paid" id="paid" />
                        <Label htmlFor="paid" className="flex-1 cursor-pointer">
                          <div>
                            <p className="font-medium">Paid Mint</p>
                            <p className="text-sm text-muted-foreground">
                              Set a mint price in ETH
                            </p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {nftForm.mintModel === "paid" && (
                    <div className="space-y-2">
                      <Label htmlFor="mint-price">Mint Price (STRK)</Label>
                      <Input
                        id="mint-price"
                        placeholder="25"
                        value={nftForm.mintPrice}
                        onChange={(e) => setNftForm({ ...nftForm, mintPrice: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="wallet-limit">Per Wallet Limit</Label>
                    <Input
                      id="wallet-limit"
                      type="number"
                      placeholder="5"
                      value={nftForm.perWalletLimit}
                      onChange={(e) => setNftForm({ ...nftForm, perWalletLimit: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum NFTs per wallet (leave empty for unlimited)
                    </p>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nft-image">Collection Image URL</Label>
                    <Input
                      id="nft-image"
                      placeholder="https://..."
                      value={nftForm.imageUrl}
                      onChange={(e) => setNftForm({ ...nftForm, imageUrl: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload collection artwork (recommended: 1000x1000px)
                    </p>
                  </div>
                  {nftForm.imageUrl && (
                    <div className="border border-border rounded-lg p-4 flex items-center justify-center">
                      <img
                        src={nftForm.imageUrl}
                        alt="Collection preview"
                        className="max-w-full max-h-64 rounded-lg object-cover"
                      />
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Collection Name</p>
                      <p className="font-medium">{nftForm.name || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Max Supply</p>
                      <p className="font-medium">{nftForm.maxSupply || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Mint Model</p>
                      <p className="font-medium capitalize">{nftForm.mintModel}</p>
                    </div>
                    {nftForm.mintModel === "paid" && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Mint Price</p>
                        <p className="font-medium">{nftForm.mintPrice} STRK</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Description</p>
                    <p>{nftForm.description || "Not set"}</p>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="mb-2">Ready to Deploy</h3>
                  <p className="text-muted-foreground mb-6">
                    Your collection is ready. Click deploy to launch on Starknet.
                  </p>
                  <Button size="lg" onClick={handleDeploy} disabled={isDeploying}>
                    {isDeploying ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      "Deploy Collection"
                    )}
                  </Button>
                </div>
              )}

              {/* Navigation */}
              {step < 5 && (
                <div className="flex gap-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                    disabled={step === 1}
                    className="flex-1"
                  >
                    Previous
                  </Button>
                  <Button onClick={() => setStep(step + 1)} className="flex-1">
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <DialogTitle className="text-center">
              {projectType === "token" ? "Token" : "Collection"} Deployed Successfully!
            </DialogTitle>
            <DialogDescription className="text-center">
              Your {projectType === "token" ? "token" : "NFT collection"} has been deployed to Starknet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm flex-1 truncate">{deploymentData.txHash}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(deploymentData.txHash)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {projectType === "token" ? "Token" : "Collection"} Address
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-sm flex-1 truncate">{deploymentData.address}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(deploymentData.address)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open("https://starkscan.co", "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Explorer
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setShowSuccess(false);
                  navigate("/profile");
                }}
              >
                Go to Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
