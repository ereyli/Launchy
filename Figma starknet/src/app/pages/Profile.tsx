import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Coins, Image as ImageIcon, TrendingUp, DollarSign, ExternalLink, Plus } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function Profile() {
  const portfolioStats = [
    { label: "Total Value", value: "$12,450", icon: DollarSign, change: "+15.2%" },
    { label: "Tokens Deployed", value: "3", icon: Coins, change: null },
    { label: "Collections", value: "2", icon: ImageIcon, change: null },
    { label: "Total Revenue", value: "$4,280", icon: TrendingUp, change: "+8.4%" },
  ];

  const deployedTokens = [
    {
      id: 1,
      name: "My DeFi Token",
      symbol: "MDT",
      logo: "https://images.unsplash.com/photo-1644343262170-e40d72e19a84?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcnlwdG9jdXJyZW5jeSUyMGJsb2NrY2hhaW4lMjBuZXR3b3JrfGVufDF8fHx8MTc3MjYxMzU5N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      status: "Listed",
      supply: "500,000",
      holders: 234,
      marketCap: "$120K",
      revenue: "$1,850",
    },
    {
      id: 2,
      name: "Gaming Token",
      symbol: "GME",
      logo: "https://images.unsplash.com/photo-1756908992154-c8a89f5e517f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGhvbG9ncmFtfGVufDF8fHx8MTc3MjYxMjQ4MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      status: "Listed",
      supply: "1,000,000",
      holders: 567,
      marketCap: "$280K",
      revenue: "$2,430",
    },
    {
      id: 3,
      name: "DAO Token",
      symbol: "DAO",
      logo: "https://images.unsplash.com/photo-1654183621855-8fd86fd79d6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG5mdCUyMGRpZ2l0YWwlMjBhcnR8ZW58MXx8fHwxNzcyNzE4MTkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      status: "Deployed",
      supply: "250,000",
      holders: 123,
      marketCap: "$0",
      revenue: "$0",
    },
  ];

  const deployedCollections = [
    {
      id: 1,
      name: "My Art Collection",
      image: "https://images.unsplash.com/photo-1728281144091-b743062a9bf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbmVyJTIwd29ya3NwYWNlfGVufDF8fHx8MTc3MjY2Nzk5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 432,
      total: 1000,
      revenue: "$3,456",
      model: "Paid Mint",
    },
    {
      id: 2,
      name: "Digital Dreams",
      image: "https://images.unsplash.com/photo-1654183621855-8fd86fd79d6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG5mdCUyMGRpZ2l0YWwlMjBhcnR8ZW58MXx8fHwxNzcyNzE4MTkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 1523,
      total: 2000,
      revenue: "$0",
      model: "Free Mint",
    },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="mb-2">Creator Dashboard</h1>
            <p className="text-muted-foreground">Manage your tokens and collections</p>
          </div>
          <Button asChild>
            <Link to="/create">
              <Plus className="w-4 h-4 mr-2" />
              Create New
            </Link>
          </Button>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {portfolioStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold">{stat.value}</span>
                    {stat.change && (
                      <span className="text-sm text-green-500 font-medium">
                        {stat.change}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tokens" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tokens" className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Tokens ({deployedTokens.length})
            </TabsTrigger>
            <TabsTrigger value="collections" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Collections ({deployedCollections.length})
            </TabsTrigger>
          </TabsList>

          {/* Tokens Tab */}
          <TabsContent value="tokens" className="space-y-4">
            {deployedTokens.map((token) => (
              <Card key={token.id} className="hover:border-primary/50 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <ImageWithFallback
                      src={token.logo}
                      alt={token.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg">{token.name}</h3>
                        <Badge variant={token.status === "Listed" ? "default" : "secondary"}>
                          {token.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{token.symbol}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Supply</p>
                          <p className="font-medium">{token.supply}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Holders</p>
                          <p className="font-medium">{token.holders}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
                          <p className="font-medium">{token.marketCap}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                          <p className="font-medium text-green-500">{token.revenue}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/token/${token.id}`}>
                          View Details
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href="https://starkscan.co" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Explorer
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Collections Tab */}
          <TabsContent value="collections" className="space-y-4">
            {deployedCollections.map((collection) => (
              <Card key={collection.id} className="hover:border-primary/50 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden border border-border flex-shrink-0">
                      <ImageWithFallback
                        src={collection.image}
                        alt={collection.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg">{collection.name}</h3>
                        <Badge variant="secondary">{collection.model}</Badge>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Minted</span>
                          <span>
                            {collection.minted.toLocaleString()} /{" "}
                            {collection.total.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/70"
                            style={{
                              width: `${(collection.minted / collection.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Progress</p>
                          <p className="font-medium">
                            {((collection.minted / collection.total) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                          <p className="font-medium text-green-500">{collection.revenue}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/collection/${collection.id}`}>
                          View Collection
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href="https://starkscan.co" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Explorer
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
