import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Clock, CheckCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { format, addDays } from "date-fns";

export default function ApplicationStatus() {
  const [searchValue, setSearchValue] = useState("");
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast.error("Please enter an email or phone number");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Search by email or phone
      const { data, error } = await supabase
        .from("helper_applications")
        .select("*")
        .or(`email.eq.${searchValue},phone.eq.${searchValue}`)
        .single();

      if (error || !data) {
        setApplication(null);
        return;
      }

      setApplication(data);
    } catch (error) {
      console.error("Error searching application:", error);
      toast.error("Failed to search application");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return (
          <Badge className="bg-yellow-500 text-white">
            <Clock className="w-4 h-4 mr-1" />
            Application Pending
          </Badge>
        );
      case "Approved":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle className="w-4 h-4 mr-1" />
            Application Approved!
          </Badge>
        );
      case "Rejected":
        return (
          <Badge className="bg-red-500 text-white">
            <XCircle className="w-4 h-4 mr-1" />
            Application Not Approved
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Check Application Status</h1>
          <p className="text-muted-foreground text-lg">
            Enter your email or phone number to check your helper application status
          </p>
        </div>

        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Your Application</CardTitle>
            <CardDescription>Enter the email or phone number you used to apply</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter email or phone number"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Searching..." : "Check Status"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {searched && !loading && (
          <>
            {application ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Application Details</CardTitle>
                    {getStatusBadge(application.application_status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Pending Status */}
                  {application.application_status === "Pending" && (
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                      <p className="text-lg mb-2 text-yellow-900 dark:text-yellow-100">
                        Your application is under review. We'll notify you within 2-3 business days.
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
                        <p>
                          <span className="font-semibold text-yellow-900 dark:text-yellow-100">Application ID:</span>{" "}
                          {application.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p>
                          <span className="font-semibold text-yellow-900 dark:text-yellow-100">Applied on:</span>{" "}
                          {format(new Date(application.created_at), "PPP")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Approved Status */}
                  {application.application_status === "Approved" && (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                      <p className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                        Congratulations! Your application has been approved.
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-green-800 dark:text-green-200">
                        <p>
                          <span className="font-semibold text-green-900 dark:text-green-100">Approved on:</span>{" "}
                          {application.approved_at
                            ? format(new Date(application.approved_at), "PPP")
                            : "N/A"}
                        </p>
                      </div>
                      <Link to="/auth">
                        <Button className="mt-4 w-full">Login to Dashboard</Button>
                      </Link>
                    </div>
                  )}

                  {/* Rejected Status */}
                  {application.application_status === "Rejected" && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                      <p className="text-lg font-semibold text-red-900 dark:text-red-100 mb-4">
                        Your application was not approved at this time.
                      </p>
                      {application.rejection_reason && (
                        <div className="mb-4">
                          <p className="font-semibold text-sm mb-1 text-red-900 dark:text-red-100">Reason:</p>
                          <p className="text-sm text-red-800 dark:text-red-200">
                            {application.rejection_reason}
                          </p>
                        </div>
                      )}
                      <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                        <p>
                          <span className="font-semibold text-red-900 dark:text-red-100">Rejected on:</span>{" "}
                          {format(new Date(application.created_at), "PPP")}
                        </p>
                        <p>
                          <span className="font-semibold text-red-900 dark:text-red-100">Can reapply on:</span>{" "}
                          {format(addDays(new Date(application.created_at), 30), "PPP")}
                        </p>
                      </div>
                      <p className="mt-4 text-sm text-red-700 dark:text-red-300">
                        You can reapply after 30 days from rejection date
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <XCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Application Found</h3>
                  <p className="text-muted-foreground mb-6">
                    We couldn't find an application with this email or phone number
                  </p>
                  <Link to="/become-helper">
                    <Button>Apply Now</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
