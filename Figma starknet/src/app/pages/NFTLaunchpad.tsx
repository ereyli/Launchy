import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Sparkles } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Skeleton } from "../components/ui/skeleton";

export function NFTLaunchpad() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("trending");
  const [isLoading, setIsLoading] = useState(false);

  const collections = [
    {
      id: 1,
      name: "Starknet Punks",
      image: "https://images.unsplash.com/photo-1654183621855-8fd86fd79d6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG5mdCUyMGRpZ2l0YWwlMjBhcnR8ZW58MXx8fHwxNzcyNzE4MTkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 2847,
      total: 10000,
      price: "Free",
      model: "Free Mint",
      trending: true,
    },
    {
      id: 2,
      name: "Cairo Creatures",
      image: "https://images.unsplash.com/photo-1756908992154-c8a89f5e517f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGhvbG9ncmFtfGVufDF8fHx8MTc3MjYxMjQ4MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 1523,
      total: 5000,
      price: "15 STRK",
      model: "Paid Mint",
      trending: false,
    },
    {
      id: 3,
      name: "Abstract Art Club",
      image: "https://images.unsplash.com/photo-1728281144091-b743062a9bf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbmVyJTIwd29ya3NwYWNlfGVufDF8fHx8MTc3MjY2Nzk5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 892,
      total: 3000,
      price: "25 STRK",
      model: "Paid Mint",
      trending: true,
    },
    {
      id: 4,
      name: "Digital Dreams",
      image: "https://images.unsplash.com/photo-1644343262170-e40d72e19a84?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcnlwdG9jdXJyZW5jeSUyMGJsb2NrY2hhaW4lMjBuZXR3b3JrfGVufDF8fHx8MTc3MjYxMzU5N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 4521,
      total: 8000,
      price: "Free",
      model: "Free Mint",
      trending: false,
    },
    {
      id: 5,
      name: "Cosmic Warriors",
      image: "https://images.unsplash.com/photo-1756908992154-c8a89f5e517f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwdGVjaG5vbG9neSUyMGhvbG9ncmFtfGVufDF8fHx8MTc3MjYxMjQ4MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 678,
      total: 2000,
      price: "35 STRK",
      model: "Paid Mint",
      trending: true,
    },
    {
      id: 6,
      name: "Pixel Legends",
      image: "https://images.unsplash.com/photo-1654183621855-8fd86fd79d6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG5mdCUyMGRpZ2l0YWwlMjBhcnR8ZW58MXx8fHwxNzcyNzE4MTkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      minted: 2341,
      total: 6000,
      price: "10 STRK",
      model: "Paid Mint",
      trending: false,
    },
  ];

  const filteredCollections = collections.filter((collection) => {
    const matchesSearch = collection.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPrice = 
      priceFilter === "all" || 
      (priceFilter === "free" && collection.price === "Free") ||
      (priceFilter === "paid" && collection.price !== "Free");
    return matchesSearch && matchesPrice;
  });

  const spotlightCollection = collections.find(c => c.id === 3);

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2">NFT Launchpad</h1>
          <p className="text-muted-foreground">Discover and mint NFT collections on Starknet</p>
        </div>

        {/* Spotlight */}
        {spotlightCollection && (
          <Card className="mb-8 overflow-hidden border-primary/50">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="aspect-square md:aspect-auto overflow-hidden">
                <ImageWithFallback
                  src={spotlightCollection.image}
                  alt={spotlightCollection.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex flex-col justify-center">
                <Badge className="w-fit mb-4">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Spotlight Collection
                </Badge>
                <h2 className="mb-3">{spotlightCollection.name}</h2>
                <p className="text-muted-foreground mb-6">
                  A unique collection of abstract digital art pieces, each one
                  representing a different emotion and story from the creator.
                </p>
                <div className="space-y-4 mb-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Minted</span>
                      <span>
                        {spotlightCollection.minted.toLocaleString()} /{" "}
                        {spotlightCollection.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/70"
                        style={{
                          width: `${
                            (spotlightCollection.minted / spotlightCollection.total) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Mint Price</span>
                    <span className="text-xl font-bold">{spotlightCollection.price}</span>
                  </div>
                </div>
                <Button size="lg" asChild>
                  <Link to={`/collection/${spotlightCollection.id}`}>Mint Now</Link>
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={priceFilter} onValueChange={setPriceFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Collection Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <Skeleton className="aspect-square w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCollections.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2">No collections found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search or filter criteria
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setPriceFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map((collection) => (
              <Link key={collection.id} to={`/collection/${collection.id}`}>
                <Card className="group hover:border-primary/50 transition-all overflow-hidden h-full">
                  <div className="aspect-square overflow-hidden relative">
                    <ImageWithFallback
                      src={collection.image}
                      alt={collection.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {collection.trending && (
                      <Badge className="absolute top-3 right-3">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{collection.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {collection.model}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
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
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Mint Price</span>
                        <span className="font-medium">{collection.price}</span>
                      </div>
                      <Button className="w-full opacity-0 group-hover:opacity-100 transition-opacity">
                        Mint Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
