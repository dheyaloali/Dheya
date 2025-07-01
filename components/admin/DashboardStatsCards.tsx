import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CalendarDays, BarChart3, DollarSign } from "lucide-react";
import { useCurrency } from "@/components/providers/currency-provider";

export interface DashboardStats {
  totalEmployees: number;
  employeeGrowth: number;
  attendanceToday: number;
  attendanceRate: number;
  totalSales: number;
  salesGrowth: number;
  pendingSalaries: number;
  pendingSalariesCount: number;
}

function formatLargeNumber(num: number | null | undefined, formatCurrency: (amount: number) => string): string {
  if (!num) return formatCurrency(0);
  if (num >= 1e12) return formatCurrency(num / 1e12) + "T";
  if (num >= 1e9) return formatCurrency(num / 1e9) + "B";
  if (num >= 1e6) return formatCurrency(num / 1e6) + "M";
  if (num >= 1e3) return formatCurrency(num / 1e3) + "K";
  return formatCurrency(num);
}

export const DashboardStatsCards = ({
  stats,
  loading,
  isMinimalData = false,
}: {
  stats: DashboardStats;
  loading: boolean;
  isMinimalData?: boolean;
}) => {
  const { formatCompactAmount } = useCurrency();
  
  const employeeGrowthText = stats.employeeGrowth > 0
    ? `+${stats.employeeGrowth} from last month`
    : stats.employeeGrowth < 0
      ? `${stats.employeeGrowth} from last month`
      : 'No change from last month';

  const attendanceRateText =
    stats.totalEmployees > 0
      ? `${stats.attendanceRate}% attendance rate`
      : 'No employees';

  const salesGrowthText =
    stats.salesGrowth > 0
      ? `+${stats.salesGrowth}% from last month`
      : stats.salesGrowth < 0
        ? `${stats.salesGrowth}% from last month`
        : 'No change from last month';

  const pendingSalariesText =
    stats.pendingSalariesCount === 1
      ? 'For 1 employee'
      : `For ${stats.pendingSalariesCount} employees`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
      {/* Total Employees */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? <Skeleton className="h-8 w-20" /> : stats.totalEmployees}
          </div>
          <div className="text-xs text-muted-foreground">
            {loading || isMinimalData ? 
              <Skeleton className={`h-4 w-28 ${isMinimalData ? 'bg-gray-100' : ''}`} /> : 
              employeeGrowthText
            }
          </div>
        </CardContent>
      </Card>
      {/* Today's Attendance */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? <Skeleton className="h-8 w-20" /> : stats.attendanceToday}
          </div>
          <div className="text-xs text-muted-foreground">
            {loading || isMinimalData ? 
              <Skeleton className={`h-4 w-28 ${isMinimalData ? 'bg-gray-100' : ''}`} /> : 
              attendanceRateText
            }
          </div>
        </CardContent>
      </Card>
      {/* Total Sales */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold truncate" style={{ maxWidth: 220 }}>
            {loading || isMinimalData ? 
              <Skeleton className={`h-8 w-24 ${isMinimalData ? 'bg-gray-100' : ''}`} /> : 
              formatLargeNumber(stats.totalSales, formatCompactAmount)
            }
          </div>
          <div className="text-xs text-muted-foreground">
            {loading || isMinimalData ? 
              <Skeleton className={`h-4 w-28 ${isMinimalData ? 'bg-gray-100' : ''}`} /> : 
              salesGrowthText
            }
          </div>
        </CardContent>
      </Card>
      {/* Pending Salaries */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Salaries</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading || isMinimalData ? 
              <Skeleton className={`h-8 w-20 ${isMinimalData ? 'bg-gray-100' : ''}`} /> : 
              formatCompactAmount(stats.pendingSalaries)
            }
          </div>
          <div className="text-xs text-muted-foreground">
            {loading || isMinimalData ? 
              <Skeleton className={`h-4 w-28 ${isMinimalData ? 'bg-gray-100' : ''}`} /> : 
              pendingSalariesText
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 