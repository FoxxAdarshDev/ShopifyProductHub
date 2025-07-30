import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProductManager from "@/pages/ProductManager";
import AllProducts from "@/pages/AllProducts";
import DraftModeProducts from "@/pages/DraftModeProducts";
import NewLayoutProducts from "@/pages/NewLayoutProducts";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/Sidebar";

function Router() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={AllProducts} />
          <Route path="/product-manager" component={ProductManager} />
          <Route path="/product-manager/:productId" component={ProductManager} />
          <Route path="/products/:productId" component={ProductManager} />
          <Route path="/all-products" component={AllProducts} />
          <Route path="/draft-mode" component={DraftModeProducts} />
          <Route path="/new-layout" component={NewLayoutProducts} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
