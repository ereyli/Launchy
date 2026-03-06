import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, Minus, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";

export function CollectionDetail() {
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [isMinting, setIsMinting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mintedTokenIds, setMintedTokenIds] = useState<number[]>([]);

  const collection = {
    id: 1,
    name: "Abstract Art Club",
    image: "https://images.unsplash.com/photo-1728281144091-b743062a9bf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbmVyJTIwd29ya3NwYWNlfGVufDF8fHx8MTc3MjY2Nzk5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    description:
      "A unique collection of abstract digital art pieces, each one representing a different emotion and story from the creator. Limited to 3,000 pieces.",
    minted: 892,
    total: 3000,
    price: "25",
    model: "Paid Mint",
    address: "0xabcd...1234",
    creator: "0x5678...efgh",
    perWalletLimit: 5,
  };

  const handleMint = async () => {
    setIsMinting(true);
    // Simulate minting
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setIsMinting(false);
    
    // Generate random token IDs
    const ids = Array.from({ length: quantity }, () => 
      Math.floor(Math.random() * 10000) + 1
    );
    setMintedTokenIds(ids);
    setShowSuccess(true);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(collection.address);
    toast.success("Address copied to clipboard");
  };

  const totalCost = (parseFloat(collection.price) * quantity).toFixed(2);
  const gasFee = "0.5";
  const grandTotal = (parseFloat(totalCost) + parseFloat(gasFee)).toFixed(2);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/nft-launchpad">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Launchpad
          </Link>
        </Button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Collection Image */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden border border-border bg-muted">
              <ImageWithFallback
                src={collection.image}
                alt={collection.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Collection Info & Mint */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl">{collection.name}</h1>
                <Badge>{collection.model}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span>by</span>
                <code className="bg-muted px-2 py-1 rounded">{collection.creator}</code>
                <Button size="sm" variant="ghost" asChild>
                  <a href="https://starkscan.co" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </div>
              <p className="text-muted-foreground mb-6">{collection.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground mb-1">Total Supply</p>
                    <p className="text-2xl font-bold">{collection.total.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground mb-1">Minted</p>
                    <p className="text-2xl font-bold">{collection.minted.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Mint Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Mint Progress</span>
                  <span className="font-medium">
                    {((collection.minted / collection.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                    style={{ width: `${(collection.minted / collection.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {(collection.total - collection.minted).toLocaleString()} remaining
                </p>
              </div>
            </div>

            {/* Mint Card */}
            <Card>
              <CardHeader>
                <CardTitle>Mint NFT</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Quantity</span>
                      <span className="text-sm text-muted-foreground">
                        Max {collection.perWalletLimit} per wallet
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <div className="flex-1 text-center">
                        <span className="text-2xl font-bold">{quantity}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setQuantity(Math.min(collection.perWalletLimit, quantity + 1))
                        }
                        disabled={quantity >= collection.perWalletLimit}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mint Price</span>
                      <span>{collection.price} STRK × {quantity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Cost</span>
                      <span className="font-medium">{totalCost} STRK</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gas Fee (est.)</span>
                      <span>{gasFee} STRK</span>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between">
                      <span className="font-medium">Total</span>
                      <span className="font-bold text-lg">{grandTotal} STRK</span>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Your Balance</span>
                    <span className="font-medium">1,245.50 STRK</span>
                  </div>

                  {/* Mint Button */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleMint}
                    disabled={isMinting}
                  >
                    {isMinting ? "Minting..." : `Mint ${quantity} NFT${quantity > 1 ? "s" : ""}`}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By minting, you agree to our terms and conditions
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Collection Details */}
            <Card>
              <CardHeader>
                <CardTitle>Collection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contract Address</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{collection.address}</code>
                    <Button size="sm" variant="ghost" onClick={copyAddress}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Token Standard</span>
                  <span>ERC-721</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Blockchain</span>
                  <span>Starknet</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Creator Earnings</span>
                  <span>5%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-6 h-6 text-green-500" />
            </div>
            <DialogTitle className="text-center">
              Successfully Minted!
            </DialogTitle>
            <DialogDescription className="text-center">
              You minted {quantity} NFT{quantity > 1 ? "s" : ""} from {collection.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Token IDs</p>
              <div className="flex flex-wrap gap-2">
                {mintedTokenIds.map((id) => (
                  <Badge key={id} variant="secondary">
                    #{id}
                  </Badge>
                ))}
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
                  setQuantity(1);
                }}
              >
                Mint More
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
