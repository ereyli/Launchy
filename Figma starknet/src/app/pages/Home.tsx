import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ArrowRight, Rocket, Shield, Zap, TrendingUp, Coins, Image as ImageIcon } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function Home() {
  const stats = [
    { label: "Deployed Tokens", value: "1,247" },
    { label: "Listed Tokens", value: "892" },
    { label: "Collections", value: "3,456" },
    { label: "Minted NFTs", value: "45.2K" },
  ];

  const featuredTokens = [
    {
      id: 1,
      name: "Starknet Token",
      symbol: "STRK",
      logo: "https://images.unsplash.com/photo-1644343262170-e40d72e19a84?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcnlwdG9jdXJyZW5jeSUyMGJsb2NrY2hhaW4lMjBuZXR3b3JrfGVufDF8fHx8MTc3MjYxMzU5N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      supply: "1,000,000",
      marketCap: "$450K",
      status: "Listed",
      change: "+24.5%",
    },
    {
      id: 2,
      name: "Ekubo Finance",
      symbol: "EKU",
      logo: "https://images.unsplash.com/photo-1654183621855-8fd86fd79d6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG5mdCUyMGRpZ2l0YWwlMjBhcnR8ZW58MXx8fHwxNzcyNzE4MTkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      supply: "500,000",
      marketCap: "$320K",
      status: "Deployed",
      change: "+12.3%",
    },
    {
      id: 3,
      name: "Cairo Token",
      symbol: "CAI",
      logo: "https://images.unsplash.com/photo-1756908992154-c8a89f5e517f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGhvbG9ncmFtfGVufDF8fHx8MTc3MjYxMjQ4MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      supply: "750,000",
      marketCap: "$280K",
      status: "Listed",
      change: "+18.7%",
    },
  ];

  const featuredNFTs = [
    {
      id: 1,
      name: "Starknet Punks",
      image: "https://images.unsplash.com/photo-1654183621855-8fd86fd79d6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG5mdCUyMGRpZ2l0YWwlMjBhcnR8ZW58MXx8fHwxNzcyNzE4MTkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 2847,
      total: 10000,
      price: "Free",
    },
    {
      id: 2,
      name: "Cairo Creatures",
      image: "https://images.unsplash.com/photo-1756908992154-c8a89f5e517f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGhvbG9ncmFtfGVufDF8fHx8MTc3MjYxMjQ4MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 1523,
      total: 5000,
      price: "15 STRK",
    },
    {
      id: 3,
      name: "Abstract Art Club",
      image: "https://images.unsplash.com/photo-1728281144091-b743062a9bf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbmVyJTIwd29ya3NwYWNlfGVufDF8fHx8MTc3MjY2Nzk5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 892,
      total: 3000,
      price: "25 STRK",
    },
  ];

  const steps = [
    {
      icon: Rocket,
      title: "Create Your Project",
      description: "Launch tokens or NFT collections with our easy-to-use wizard",
    },
    {
      icon: Shield,
      title: "Deploy on Starknet",
      description: "Secure, fast, and low-cost deployment on Starknet",
    },
    {
      icon: Zap,
      title: "Start Trading",
      description: "List on Ekubo DEX and start building your community",
    },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-6">
              <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse" />
              Powered by Starknet
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Launch Your NFT or Token on Starknet
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              The premier launchpad for creators. Deploy tokens, create NFT collections,
              and build your community on the most advanced L2.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="group">
                <Link to="/create?type=token">
                  Launch Token
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="group">
                <Link to="/create?type=nft">
                  Create NFT Collection
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Tokens */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="flex items-center gap-2 mb-2">
              <Coins className="w-6 h-6 text-primary" />
              Featured Tokens
            </h2>
            <p className="text-muted-foreground">Trending tokens on Launchy</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/token-launchpad">
              View All <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredTokens.map((token) => (
            <Card key={token.id} className="group hover:border-primary/50 transition-all cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <ImageWithFallback
                      src={token.logo}
                      alt={token.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <CardTitle className="text-base">{token.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{token.symbol}</p>
                    </div>
                  </div>
                  <Badge
                    variant={token.status === "Listed" ? "default" : "secondary"}
                  >
                    {token.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Supply</span>
                    <span>{token.supply}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Market Cap</span>
                    <span>{token.marketCap}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">24h Change</span>
                    <span className="text-sm font-medium text-green-500 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {token.change}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured NFTs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-6 h-6 text-primary" />
              Featured NFT Collections
            </h2>
            <p className="text-muted-foreground">Popular collections on Launchy</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/nft-launchpad">
              View All <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredNFTs.map((nft) => (
            <Card key={nft.id} className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden">
              <div className="aspect-square overflow-hidden">
                <ImageWithFallback
                  src={nft.image}
                  alt={nft.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardHeader>
                <CardTitle className="text-base">{nft.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Minted</span>
                      <span>
                        {nft.minted.toLocaleString()} / {nft.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/70"
                        style={{ width: `${(nft.minted / nft.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Mint Price</span>
                    <span className="font-medium">{nft.price}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="mb-2">How It Works</h2>
            <p className="text-muted-foreground">Launch your project in 3 simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-br from-primary/10 to-transparent border border-border rounded-2xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Built on Starknet</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Launchy leverages Starknet's cutting-edge technology for secure, fast, and
              cost-effective token and NFT launches. With gasless minting and seamless
              Ekubo integration, we make launching accessible to everyone.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Badge variant="secondary" className="text-sm px-4 py-2">
                <Shield className="w-4 h-4 mr-2" />
                Secure & Audited
              </Badge>
              <Badge variant="secondary" className="text-sm px-4 py-2">
                <Zap className="w-4 h-4 mr-2" />
                Gasless Minting
              </Badge>
              <Badge variant="secondary" className="text-sm px-4 py-2">
                <Coins className="w-4 h-4 mr-2" />
                Ekubo Integration
              </Badge>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
