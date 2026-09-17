import prisma from "../../../prisma/client.js";
import { startOfDay, endOfDay, subDays, addDays } from "date-fns";
import {
  configuredOperations,
  createOperationsService,
} from "./helpers/operations.service.js";

// Re-export all specialized reporting and live usage engines for full backward compatibility
export * from "./helpers/twilio-reporting.js";
export * from "./helpers/vapi-reporting.js";
export * from "./helpers/report-metrics.js";
export * from "./helpers/live-usage.js";
export * from "./helpers/operations.service.js";

// --- Dashboard Operations Instance ---
let operationsInstance;
const getOperations = () =>
  (operationsInstance ||= configuredOperations(prisma).catch((error) => {
    operationsInstance = null;
    throw error;
  }));

// --- Helper for Percentage Calculation ---
const calculateChange = (current, previous) => {
  if (previous === 0) return current > 0 ? "+100.00%" : "0.00%";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
};

// --- Main System Owner Database Stats ---
const getDashboardStatsFromDB = async () => {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const sixtyDaysAgo = subDays(now, 60);
  const thirtyDaysFromNow = addDays(now, 30);

  // --- Parallel Database Metrics Execution ---
  const [
    totalTenantsVal,
    newTenantsThisPeriod,
    newTenantsPrevPeriod,
    activeSubsVal,
    newSubsThisPeriod,
    newSubsPrevPeriod,
    revenueSumThisPeriod,
    revenueSumPrevPeriod,
    expiringVal,
    expiredThisPeriod,
    expiredPrevPeriod,
    plans,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.business.count({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
    prisma.subscription.count({
      where: { status: "active" },
    }),
    prisma.subscription.count({
      where: { status: "active", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.subscription.count({
      where: {
        status: "active",
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    }),
    prisma.invoice.aggregate({
      where: {
        status: "paid",
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.invoice.aggregate({
      where: {
        status: "paid",
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.subscription.count({
      where: {
        status: "active",
        endDate: { gte: now, lte: thirtyDaysFromNow },
      },
    }),
    prisma.subscription.count({
      where: {
        status: "expired",
        endDate: { gte: thirtyDaysAgo, lte: now },
      },
    }),
    prisma.subscription.count({
      where: {
        status: "expired",
        endDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    }),
    prisma.plan.findMany(),
  ]);

  const tenantsChange = calculateChange(
    newTenantsThisPeriod,
    newTenantsPrevPeriod,
  );
  const tenantsSubtext = `${newTenantsThisPeriod >= newTenantsPrevPeriod ? "+" : ""}${newTenantsThisPeriod - newTenantsPrevPeriod} last month`;

  const subsChange = calculateChange(newSubsThisPeriod, newSubsPrevPeriod);
  const subsSubtext = `${newSubsThisPeriod >= newSubsPrevPeriod ? "+" : ""}${newSubsThisPeriod - newSubsPrevPeriod} last month`;

  const revThisVal = revenueSumThisPeriod._sum.amount || 0;
  const revPrevVal = revenueSumPrevPeriod._sum.amount || 0;
  const revChange = calculateChange(revThisVal, revPrevVal);
  const revSubtext = `${revThisVal >= revPrevVal ? "+" : ""}${revThisVal - revPrevVal >= 0 ? "$" : "-$"}${Math.abs(revThisVal - revPrevVal).toFixed(0)} last month`;

  const expiringChange = calculateChange(expiredThisPeriod, expiredPrevPeriod);
  const expiringSubtext = `${expiredThisPeriod >= expiredPrevPeriod ? "+" : ""}${expiredThisPeriod - expiredPrevPeriod} last month`;

  // --- Sparkline Data Generation (Last 7 Days in Parallel) ---
  const sparklineDays = 7;
  const days = Array.from({ length: sparklineDays }, (_, idx) => {
    const i = sparklineDays - 1 - idx;
    const date = subDays(now, i);
    return {
      start: startOfDay(date),
      end: endOfDay(date),
    };
  });

  const sparklineResults = await Promise.all(
    days.map(async ({ start, end }) => {
      const [tenantsCount, subsCount, revSum, expiringCount] =
        await Promise.all([
          prisma.business.count({
            where: { createdAt: { gte: start, lte: end } },
          }),
          prisma.subscription.count({
            where: {
              status: "active",
              createdAt: { gte: start, lte: end },
            },
          }),
          prisma.invoice.aggregate({
            where: {
              status: "paid",
              createdAt: { gte: start, lte: end },
            },
            _sum: { amount: true },
          }),
          prisma.subscription.count({
            where: {
              status: "active",
              endDate: { gte: start, lte: end },
            },
          }),
        ]);

      return {
        tenantsCount,
        subsCount,
        revSum: revSum._sum.amount || 0,
        expiringCount,
      };
    }),
  );

  const totalTenantsSparkline = sparklineResults.map((r) => r.tenantsCount);
  const activeSubscriptionsSparkline = sparklineResults.map((r) => r.subsCount);
  const monthlyRevenueSparkline = sparklineResults.map((r) => r.revSum);
  const expiringTenantsSparkline = sparklineResults.map((r) => r.expiringCount);

  // --- Plan Distribution ---
  const planDistribution = await Promise.all(
    plans.map(async (p) => {
      const count = await prisma.subscription.count({
        where: { planId: p.id, status: "active" },
      });
      const percentage =
        activeSubsVal > 0 ? Math.round((count / activeSubsVal) * 100) : 0;
      return {
        name: p.name,
        count,
        percentage,
      };
    }),
  );

  // --- Tenant Status Distribution ---
  const statuses = ["active", "suspended", "trial", "expired"];
  const tenantStatusDistribution = await Promise.all(
    statuses.map(async (status) => {
      const count = await prisma.business.count({ where: { status } });
      const percentage =
        totalTenantsVal > 0 ? Math.round((count / totalTenantsVal) * 100) : 0;
      return {
        status,
        count,
        percentage,
      };
    }),
  );

  return {
    stats: {
      totalTenants: {
        value: totalTenantsVal,
        change: tenantsChange,
        subtext: tenantsSubtext,
        sparkline: totalTenantsSparkline,
      },
      activeSubscriptions: {
        value: activeSubsVal,
        change: subsChange,
        subtext: subsSubtext,
        sparkline: activeSubscriptionsSparkline,
      },
      monthlyRevenue: {
        value: revThisVal,
        change: revChange,
        subtext: revSubtext,
        sparkline: monthlyRevenueSparkline,
      },
      expiringTenants: {
        value: expiringVal,
        change: expiringChange,
        subtext: expiringSubtext,
        sparkline: expiringTenantsSparkline,
      },
    },
    planDistribution,
    tenantStatusDistribution,
  };
};

export const DashboardService = {
  getDashboardStatsFromDB,
  getOperationsReport: async (query) => (await getOperations())(query),
  getLiveOperations: async () => (await getOperations()).live(),
  configuredOperations,
  createOperationsService,
};
