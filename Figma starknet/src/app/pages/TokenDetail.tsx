import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TokenDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [isTrading, setIsTrading] = useState(false);

  const token = {
    id: 1,
    name: "Starknet Token",
    symbol: "STRK",
    logo: "https://images.unsplash.com/photo-1644343262170-e40d72e19a84?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcnlwdG9jdXJyZW5jeSUyMGJsb2NrY2hhaW4lMjBuZXR3b3JrfGVufDF8fHx8MTc3MjYxMzU5N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    supply: "1,000,000",
    marketCap: "$450K",
    status: "Listed",
    price: "$0.45",
    change24h: "+24.5%",
    address: "0x1234...abcd",
    description: "A community-driven token on Starknet focused on DeFi applications.",
  };

  const chartData = [
    { time: "00:00", price: 0.38 },
    { time: "04:00", price: 0.42 },
    { time: "08:00", price: 0.40 },
    { time: "12:00", price: 0.43 },
    { time: "16:00", price: 0.44 },
    { time: "20:00", price: 0.45 },
  ];

  const recentTrades = [
    { type: "Buy", amount: "1,250 STRK", price: "$0.45", time: "2 min ago", user: "0xabcd...1234" },
    { type: "Sell", amount: "500 STRK", price: "$0.44", time: "5 min ago", user: "0x5678...efgh" },
    { type: "Buy", amount: "2,000 STRK", price: "$0.44", time: "8 min ago", user: "0x9012...ijkl" },
    { type: "Buy", amount: "750 STRK", price: "$0.43", time: "12 min ago", user: "0x3456...mnop" },
  ];

  const handleTrade = async () => {
    setIsTrading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsTrading(false);
    toast.success(`${activeTab === "buy" ? "Buy" : "Sell"} order submitted!`);
    setAmount("");
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(token.address);
    toast.success("Address copied to clipboard");
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/token-launchpad">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Launchpad
          </Link>
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Token Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <ImageWithFallback
                    src={token.logo}
                    alt={token.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-2xl">{token.name}</h1>
                      <Badge>{token.status}</Badge>
                    </div>
                    <p className="text-muted-foreground mb-2">{token.symbol}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <code className="bg-muted px-2 py-1 rounded">{token.address}</code>
                      <Button size="sm" variant="ghost" onClick={copyAddress}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href="https://starkscan.co" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold mb-1">{token.price}</div>
                    <div
                      className={`flex items-center gap-1 ${
                        token.change24h.startsWith("+") ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {token.change24h.startsWith("+") ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span>{token.change24h}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Supply</p>
                    <p className="font-medium">{token.supply}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Market Cap</p>
                    <p className="font-medium">{token.marketCap}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Holders</p>
                    <p className="font-medium">1,234</p>
                  </div>
                </div>
                <p className="text-sm">{token.description}</p>
              </CardContent>
            </Card>

            {/* Price Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Price Chart (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Trades */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTrades.map((trade, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={trade.type === "Buy" ? "default" : "secondary"}
                          className={trade.type === "Buy" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : ""}
                        >
                          {trade.type}
                        </Badge>
                        <div>
                          <p className="font-medium">{trade.amount}</p>
                          <p className="text-xs text-muted-foreground">{trade.user}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{trade.price}</p>
                        <p className="text-xs text-muted-foreground">{trade.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trade Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Trade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">Buy</TabsTrigger>
                    <TabsTrigger value="sell">Sell</TabsTrigger>
                  </TabsList>
                  <TabsContent value="buy" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="buy-amount">Amount (STRK)</Label>
                      <Input
                        id="buy-amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Balance: 1,245.50 STRK
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
                      <div className="flex gap-2">
                        {["0.5", "1.0", "2.0"].map((val) => (
                          <Button
                            key={val}
                            size="sm"
                            variant={slippage === val ? "default" : "outline"}
                            onClick={() => setSlippage(val)}
                          >
                            {val}%
                          </Button>
                        ))}
                        <Input
                          id="slippage"
                          type="number"
                          className="w-20"
                          value={slippage}
                          onChange={(e) => setSlippage(e.target.value)}
                        />
                      </div>
                    </div>
                    {amount && (
                      <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">You pay</span>
                          <span className="font-medium">{(parseFloat(amount || "0") * 0.45).toFixed(2)} STRK</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">You receive</span>
                          <span className="font-medium">{amount} STRK</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fee</span>
                          <span className="font-medium">0.5 STRK</span>
                        </div>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={!amount || isTrading}
                      onClick={handleTrade}
                    >
                      {isTrading ? "Processing..." : "Buy STRK"}
                    </Button>
                  </TabsContent>
                  <TabsContent value="sell" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="sell-amount">Amount (STRK)</Label>
                      <Input
                        id="sell-amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Balance: 500.00 STRK
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slippage-sell">Slippage Tolerance (%)</Label>
                      <div className="flex gap-2">
                        {["0.5", "1.0", "2.0"].map((val) => (
                          <Button
                            key={val}
                            size="sm"
                            variant={slippage === val ? "default" : "outline"}
                            onClick={() => setSlippage(val)}
                          >
                            {val}%
                          </Button>
                        ))}
                        <Input
                          id="slippage-sell"
                          type="number"
                          className="w-20"
                          value={slippage}
                          onChange={(e) => setSlippage(e.target.value)}
                        />
                      </div>
                    </div>
                    {amount && (
                      <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">You pay</span>
                          <span className="font-medium">{amount} STRK</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">You receive</span>
                          <span className="font-medium">{(parseFloat(amount || "0") * 0.45).toFixed(2)} STRK</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fee</span>
                          <span className="font-medium">0.5 STRK</span>
                        </div>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      size="lg"
                      variant="destructive"
                      disabled={!amount || isTrading}
                      onClick={handleTrade}
                    >
                      {isTrading ? "Processing..." : "Sell STRK"}
                    </Button>
                  </TabsContent>
                </Tabs>
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Powered by Ekubo DEX
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
