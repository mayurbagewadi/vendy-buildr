import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Download, Mail, UserPlus, ExternalLink, Eye, Edit, Trash2, MoreVertical, ArrowLeft, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserDetailModal } from "@/components/superadmin/UserDetailModal";
import { SuspendAccountModal } from "@/components/superadmin/SuspendAccountModal";
import { DeleteAccountModal } from "@/components/superadmin/DeleteAccountModal";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  store: {
    name: string;
    slug: string;
    id: string;
    last_admin_visit: string | null;
  } | null;
  subscription: {
    plan: {
      name: string;
    };
    status: string;
    billing_cycle: string;
    trial_ends_at: string | null;
  } | null;
  totalRevenue: number;
  lastOrderDate: string | null;
  orderCount: number;
}

interface QuickStats {
  totalUsers: number;
  activeStores: number;
  trialUsers: number;
  paidUsers: number;
  expired: number;
  cancelled: number;
  inactiveStores: number;
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStats>({
    totalUsers: 0,
    activeStores: 0,
    trialUsers: 0,
    paidUsers: 0,
    expired: 0,
    cancelled: 0,
    inactiveStores: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchQuickStats();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, user_id, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Then get stores and subscriptions for each user
      const formattedUsers = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          // Get store for this user
          const { data: stores } = await supabase
            .from("stores")
            .select("id, name, slug, last_admin_visit")
            .eq("user_id", profile.user_id)
            .limit(1);

          // Get subscription for this user
          const { data: subscriptions } = await supabase
            .from("subscriptions")
            .select(`
              status,
              billing_cycle,
              trial_ends_at,
              subscription_plans (
                name
              )
            `)
            .eq("user_id", profile.user_id)
            .limit(1);

          // Get total revenue and last order date
          const { data: orders } = await supabase
            .from("orders")
            .select("total, created_at")
            .eq("store_id", stores?.[0]?.id || "")
            .order("created_at", { ascending: false });

          const totalRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
          const lastOrderDate = orders && orders.length > 0 ? orders[0].created_at : null;
          const orderCount = orders?.length || 0;

          return {
            id: profile.user_id,
            email: profile.email,
            full_name: profile.full_name,
            phone: profile.phone,
            created_at: profile.created_at,
            store: stores?.[0] || null,
            subscription: subscriptions?.[0]
              ? {
                  plan: subscriptions[0].subscription_plans,
                  status: subscriptions[0].status,
                  billing_cycle: subscriptions[0].billing_cycle,
                  trial_ends_at: subscriptions[0].trial_ends_at,
                }
              : null,
            totalRevenue,
            lastOrderDate,
            orderCount,
          };
        })
      );

      setUsers(formattedUsers);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQuickStats = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: activeStores } = await supabase
        .from("stores")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: trialUsers } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "trial");

      const { count: paidUsers } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const { count: expired } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "expired");

      const { count: cancelled } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "cancelled");

      // Calculate inactive stores (no orders AND no admin visits in last 60 days)
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
      
      const { data: allStores } = await supabase
        .from("stores")
        .select("id, last_admin_visit");

      let inactiveCount = 0;
      if (allStores) {
        for (const store of allStores) {
          const { data: recentOrders } = await supabase
            .from("orders")
            .select("id")
            .eq("store_id", store.id)
            .gte("created_at", twoMonthsAgo.toISOString())
            .limit(1);
          
          const hasRecentOrders = recentOrders && recentOrders.length > 0;
          const hasRecentAdminVisit = store.last_admin_visit && new Date(store.last_admin_visit) >= twoMonthsAgo;
          
          // Inactive if BOTH no recent orders AND no recent admin visits
          if (!hasRecentOrders && !hasRecentAdminVisit) {
            inactiveCount++;
          }
        }
      }

      setQuickStats({
        totalUsers: totalUsers || 0,
        activeStores: activeStores || 0,
        trialUsers: trialUsers || 0,
        paidUsers: paidUsers || 0,
        expired: expired || 0,
        cancelled: cancelled || 0,
        inactiveStores: inactiveCount,
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.store?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.store?.slug?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlan =
      planFilter === "all" ||
      user.subscription?.plan?.name?.toLowerCase() === planFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "all" || user.subscription?.status === statusFilter;

    const matchesActivity = () => {
      if (activityFilter === "all") return true;
      if (activityFilter === "inactive") {
        if (!user.store) return false;
        
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
        
        const hasRecentOrders = user.lastOrderDate && new Date(user.lastOrderDate) >= twoMonthsAgo;
        const hasRecentAdminVisit = user.store.last_admin_visit && new Date(user.store.last_admin_visit) >= twoMonthsAgo;
        
        // Inactive if BOTH no recent orders AND no recent admin visits
        return !hasRecentOrders && !hasRecentAdminVisit;
      }
      if (activityFilter === "active") {
        if (!user.store) return false;
        
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
        
        const hasRecentOrders = user.lastOrderDate && new Date(user.lastOrderDate) >= twoMonthsAgo;
        const hasRecentAdminVisit = user.store.last_admin_visit && new Date(user.store.last_admin_visit) >= twoMonthsAgo;
        
        // Active if EITHER recent orders OR recent admin visits
        return hasRecentOrders || hasRecentAdminVisit;
      }
      return true;
    };

    return matchesSearch && matchesPlan && matchesStatus && matchesActivity();
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "name":
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      default:
        return 0;
    }
  });

  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalPages = Math.ceil(sortedUsers.length / rowsPerPage);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(paginatedUsers.map((user) => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    }
  };

  const handleExport = () => {
    const csvData = filteredUsers.map((user) => ({
      Email: user.email,
      Name: user.full_name || "",
      "Store Name": user.store?.name || "",
      "Store Slug": user.store?.slug || "",
      Plan: user.subscription?.plan?.name || "Free",
      Status: user.subscription?.status || "None",
      "Joined Date": new Date(user.created_at).toLocaleDateString(),
    }));

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getStatusBadge = (subscription: UserData["subscription"]) => {
    if (!subscription) {
      return <Badge variant="secondary">No Plan</Badge>;
    }

    const { status, trial_ends_at } = subscription;

    if (status === "active") {
      return <Badge className="bg-green-500">Active</Badge>;
    } else if (status === "trial") {
      const daysLeft = trial_ends_at
        ? Math.ceil(
            (new Date(trial_ends_at).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-500">
          Trial ({daysLeft}d left)
        </Badge>
      );
    } else if (status === "expired") {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (status === "cancelled") {
      return <Badge variant="secondary">Cancelled</Badge>;
    }

    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/superadmin/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Users & Stores Management</h1>
            <p className="text-muted-foreground">Manage all users and their stores</p>
          </div>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Manually Add User
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold">{quickStats.totalUsers}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Active Stores</p>
          <p className="text-2xl font-bold">{quickStats.activeStores}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Trial Users</p>
          <p className="text-2xl font-bold">{quickStats.trialUsers}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Paid Users</p>
          <p className="text-2xl font-bold">{quickStats.paidUsers}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Expired</p>
          <p className="text-2xl font-bold">{quickStats.expired}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Cancelled</p>
          <p className="text-2xl font-bold">{quickStats.cancelled}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border border-orange-500 cursor-pointer" onClick={() => setActivityFilter("inactive")}>
          <p className="text-sm text-muted-foreground">Inactive Stores</p>
          <p className="text-2xl font-bold text-orange-500">{quickStats.inactiveStores}</p>
          <p className="text-xs text-muted-foreground mt-1">No activity in 60 days</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by email, store name, or slug"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activityFilter} onValueChange={setActivityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              <SelectItem value="active">Active (recent orders)</SelectItem>
              <SelectItem value="inactive">Inactive (60+ days)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-primary/10 p-4 rounded-lg border border-primary flex items-center justify-between">
          <span className="font-medium">{selectedUsers.length} users selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Selected
            </Button>
            <Button variant="outline" size="sm">
              Change Plan
            </Button>
            <Button variant="outline" size="sm">
              Suspend
            </Button>
            <Button variant="outline" size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUsers([])}
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    paginatedUsers.length > 0 &&
                    selectedUsers.length === paginatedUsers.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>User Info</TableHead>
              <TableHead>Store Info</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={(checked) =>
                        handleSelectUser(user.id, checked as boolean)
                      }
                    />
                  </TableCell>
                   <TableCell>
                     <div className="flex items-center gap-3">
                       <Avatar>
                         <AvatarFallback>
                           {user.email[0].toUpperCase()}
                         </AvatarFallback>
                       </Avatar>
                        <div>
                          <p className="font-medium">{user.email}</p>
                          {user.full_name && (
                            <p className="text-sm text-muted-foreground">
                              {user.full_name}
                            </p>
                          )}
                          {user.phone && (
                            <p className="text-xs text-muted-foreground">
                              {user.phone}
                            </p>
                          )}
                        </div>
                     </div>
                   </TableCell>
                     <TableCell>
                       {user.store ? (
                         <div className="space-y-1">
                           <div className="flex items-center gap-2">
                             <p className="font-medium">{user.store.name}</p>
                             {(() => {
                               const twoMonthsAgo = new Date();
                               twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
                               
                               const hasRecentOrders = user.lastOrderDate && new Date(user.lastOrderDate) >= twoMonthsAgo;
                               const hasRecentAdminVisit = user.store.last_admin_visit && new Date(user.store.last_admin_visit) >= twoMonthsAgo;
                               const isInactive = !hasRecentOrders && !hasRecentAdminVisit;
                               
                               if (isInactive) {
                                 // Calculate days inactive
                                 const lastActivity = [user.lastOrderDate, user.store.last_admin_visit]
                                   .filter(Boolean)
                                   .map(d => new Date(d!))
                                   .sort((a, b) => b.getTime() - a.getTime())[0];
                                 
                                 const daysInactive = lastActivity 
                                   ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
                                   : null;
                                 
                                 return (
                                   <Badge variant="outline" className="border-orange-500 text-orange-500 text-xs">
                                     Inactive {daysInactive ? `${daysInactive}d` : ''}
                                   </Badge>
                                 );
                               }
                               return null;
                             })()}
                           </div>
                           <a 
                             href={`/${user.store.slug}`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-sm text-primary hover:underline flex items-center gap-1"
                           >
                             {user.store.slug}
                             <ExternalLink className="h-3 w-3" />
                           </a>
                           <div className="text-xs text-muted-foreground space-y-0.5">
                             <p>
                               {user.orderCount} orders
                               {user.lastOrderDate && (
                                 <> • Last: {formatDistanceToNow(new Date(user.lastOrderDate), { addSuffix: true })}</>
                               )}
                               {!user.lastOrderDate && <> • No orders yet</>}
                             </p>
                             {user.store.last_admin_visit && (
                               <p>Admin visit: {formatDistanceToNow(new Date(user.store.last_admin_visit), { addSuffix: true })}</p>
                             )}
                             {!user.store.last_admin_visit && (
                               <p>No admin visits tracked</p>
                             )}
                           </div>
                         </div>
                       ) : (
                         <span className="text-muted-foreground">No store</span>
                       )}
                     </TableCell>
                   <TableCell>
                     <p className="font-medium">₹{user.totalRevenue.toLocaleString()}</p>
                     <p className="text-xs text-muted-foreground">total revenue</p>
                   </TableCell>
                   <TableCell>
                     <Badge variant="outline">
                       {user.subscription?.plan?.name || "Free"}
                     </Badge>
                     {user.subscription && (
                       <p className="text-xs text-muted-foreground mt-1">
                         {user.subscription.billing_cycle}
                       </p>
                     )}
                   </TableCell>
                  <TableCell>{getStatusBadge(user.subscription)}</TableCell>
                  <TableCell>
                    <div>
                      <p>{new Date(user.created_at).toLocaleDateString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(user.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserDetail(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserDetail(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                           <DropdownMenuItem
                             onClick={async () => {
                               try {
                                 const { data, error } = await supabase.functions.invoke('login-as-user', {
                                   body: { user_id: user.id }
                                 });

                                 if (error) throw error;

                                 if (data?.access_token) {
                                   // Store current super admin session to restore later
                                   const { data: currentSession } = await supabase.auth.getSession();
                                   if (currentSession.session) {
                                     localStorage.setItem('superadmin_session', JSON.stringify(currentSession.session));
                                   }

                                   // Set user session
                                   await supabase.auth.setSession({
                                     access_token: data.access_token,
                                     refresh_token: data.refresh_token
                                   });

                                   toast({
                                     title: "Success",
                                     description: `Logged in as ${user.email}`,
                                   });

                                   // Redirect to admin dashboard
                                   window.location.href = '/admin/dashboard';
                                 }
                               } catch (error: any) {
                                 toast({
                                   title: "Error",
                                   description: error.message,
                                   variant: "destructive",
                                 });
                               }
                             }}
                           >
                             <UserCircle className="w-4 h-4 mr-2" />
                             Login as User
                           </DropdownMenuItem>
                           <DropdownMenuItem>
                             <Edit className="w-4 h-4 mr-2" />
                             Edit
                           </DropdownMenuItem>
                           {user.store && (
                             <DropdownMenuItem
                               onClick={() => window.open(`/${user.store.slug}`, '_blank')}
                             >
                               <ExternalLink className="w-4 h-4 mr-2" />
                               Visit Store
                             </DropdownMenuItem>
                           )}
                           <DropdownMenuItem
                             onClick={async () => {
                               const emailSubject = prompt("Enter email subject:");
                               if (!emailSubject) return;

                               const emailBody = prompt("Enter email message:");
                               if (!emailBody) return;

                               try {
                                 const { error } = await supabase.functions.invoke('send-user-email', {
                                   body: {
                                     to: user.email,
                                     subject: emailSubject,
                                     message: emailBody
                                   }
                                 });

                                 if (error) throw error;

                                 toast({
                                   title: "Email sent",
                                   description: `Email sent successfully to ${user.email}`,
                                 });
                               } catch (error: any) {
                                 toast({
                                   title: "Error",
                                   description: error.message,
                                   variant: "destructive",
                                 });
                               }
                             }}
                           >
                             <Mail className="w-4 h-4 mr-2" />
                             Send Email
                           </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setShowSuspendModal(true);
                            }}
                          >
                            Suspend Account
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * rowsPerPage + 1}-
              {Math.min(currentPage * rowsPerPage, sortedUsers.length)} of{" "}
              {sortedUsers.length} users
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      onClick={() => setCurrentPage(i + 1)}
                      isActive={currentPage === i + 1}
                      className="cursor-pointer"
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedUser && (
        <>
          <UserDetailModal
            user={selectedUser}
            open={showUserDetail}
            onClose={() => {
              setShowUserDetail(false);
              setSelectedUser(null);
            }}
            onRefresh={fetchUsers}
          />
          <SuspendAccountModal
            user={selectedUser}
            open={showSuspendModal}
            onClose={() => {
              setShowSuspendModal(false);
              setSelectedUser(null);
            }}
            onSuccess={fetchUsers}
          />
          <DeleteAccountModal
            user={selectedUser}
            open={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedUser(null);
            }}
            onSuccess={fetchUsers}
          />
        </>
      )}
    </div>
  );
}
