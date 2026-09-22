import prisma from "../../../prisma/client.js";
import { configuredOperations } from "../../systemOwner/dashboard/dashboard.service.js";
import { VapiLib } from "../../../lib/vapi.js";
import { SubscriptionService } from "../subscription/subscription.service.js";
import {
  startOfDay,
  endOfDay,
  subDays,
  format,
  isWithinInterval,
} from "date-fns";

/**
 * Auto-heal recent calls with 0 duration from Vapi API if present
 */
const healRecentZeroDurationCalls = async (businessId) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const zeroDurationCalls = await prisma.call.findMany({
      where: {
        businessId,
        duration: 0,
        startTime: { gte: fifteenMinutesAgo },
        vapiCallId: { not: { startsWith: "direct-" } },
      },
    });

    if (zeroDurationCalls.length > 0) {
      await Promise.all(
        zeroDurationCalls.map(async (call) => {
          if (!call.vapiCallId) return;
          const vapiData = await VapiLib.fetchCallById(call.vapiCallId);
          if (vapiData) {
            let dur = 0;
            if (vapiData.duration !== undefined)
              dur = Number(vapiData.duration);
            else if (vapiData.durationSeconds !== undefined)
              dur = Number(vapiData.durationSeconds);
            else if (vapiData.endedAt && vapiData.startedAt)
              dur = Math.max(
                0,
                (new Date(vapiData.endedAt).getTime() -
                  new Date(vapiData.startedAt).getTime()) /
                  1000,
              );

            if (dur > 0) {
              await prisma.call.update({
                where: { id: call.id },
                data: { duration: Math.floor(dur) },
              });
            }
          }
        }),
      );
    }
  } catch (err) {
    console.error("Dashboard auto self-heal error:", err.message);
  }
};

/**
 * Calculates start and end of the current day in UK Time (Europe/London),
 * ensuring the 'Today' metrics reset to 0 right at 12:00 AM midnight UK time.
 */
export function getLondonDayBounds(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = formatter.format(d); // "YYYY-MM-DD"

  const getOffsetMs = (targetDate) => {
    const utcDate = new Date(
      targetDate.toLocaleString("en-US", { timeZone: "UTC" }),
    );
    const londonDate = new Date(
      targetDate.toLocaleString("en-US", { timeZone: "Europe/London" }),
    );
    return londonDate.getTime() - utcDate.getTime();
  };

  const guessStart = new Date(`${dateStr}T00:00:00.000Z`);
  const offsetStart = getOffsetMs(guessStart);
  const start = new Date(guessStart.getTime() - offsetStart);

  const guessEnd = new Date(`${dateStr}T23:59:59.999Z`);
  const offsetEnd = getOffsetMs(guessEnd);
  const end = new Date(guessEnd.getTime() - offsetEnd);

  return { dateStr, start, end };
}

/**
 * Get dashboard summary stats
 * @param {string} userId - The ID of the business owner
 */
const getDashboardStats = async (userId) => {
  const business = await prisma.business.findFirst({
    where: { ownerId: userId },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  const businessId = business.id;
  await healRecentZeroDurationCalls(businessId);

  const now = new Date();
  const { start: todayStart, end: todayEnd } = getLondonDayBounds(now);

  // 1. Total Call Duration
  const totalDurationResult = await prisma.call.aggregate({
    where: { businessId },
    _sum: {
      duration: true,
    },
  });
  const totalDurationInSeconds = totalDurationResult._sum.duration || 0;

  // Format duration (e.g., "12 hr 45 min")
  const hours = Math.floor(totalDurationInSeconds / 3600);
  const minutes = Math.floor((totalDurationInSeconds % 3600) / 60);
  const totalDurationFormatted = `${hours} hr ${minutes} min`;

  // Today Call Duration
  const todayDurationResult = await prisma.call.aggregate({
    where: {
      businessId,
      startTime: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    _sum: {
      duration: true,
    },
  });
  const todayDurationInSeconds = todayDurationResult._sum.duration || 0;
  const todayHours = Math.floor(todayDurationInSeconds / 3600);
  const todayMinutes = Math.floor((todayDurationInSeconds % 3600) / 60);
  const todayDurationFormatted = `${todayHours} hr ${todayMinutes} min`;

  // 2. Today Total Call
  const todayCallCount = await prisma.call.count({
    where: {
      businessId,
      startTime: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  // 3. Total Order & Order Value
  const totalOrderCount = await prisma.order.count({
    where: { businessId },
  });

  const [totalOrderValueResult, todayOrderStatsResult] = await Promise.all([
    prisma.order.aggregate({
      where: { businessId },
      _sum: { totalPrice: true },
    }),
    prisma.order.aggregate({
      where: {
        businessId,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: { totalPrice: true },
      _count: true,
    }),
  ]);

  // 4. Calculate Dynamic Percentage Changes (Last 7 days vs Previous 7 days)
  const last7DaysStart = subDays(todayStart, 7);
  const prev7DaysStart = subDays(todayStart, 14);

  // Helper for range stats
  const getRangeStats = async (start, end) => {
    const calls = await prisma.call.aggregate({
      where: { businessId, startTime: { gte: start, lt: end } },
      _sum: { duration: true },
      _count: true,
    });
    const orders = await prisma.order.count({
      where: { businessId, createdAt: { gte: start, lt: end } },
    });
    return {
      duration: calls._sum.duration || 0,
      count: calls._count || 0,
      orders: orders,
    };
  };

  const currentPeriod = await getRangeStats(last7DaysStart, now);
  const previousPeriod = await getRangeStats(prev7DaysStart, last7DaysStart);

  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  const calculateWeeklyDiff = (current, previous) => {
    const diff = current - previous;
    return `${diff >= 0 ? "+" : ""}${diff} this week`;
  };

  // 5. Usage Overview
  const subData = await SubscriptionService.getMySubscriptionFromDB(userId);
  const totalLimitMins =
    subData?.plan?.aiMinutesLimit || subData?.plan?.callMinutesLimit || 0;
  const usedMins = subData?.aiUsedMinutes || 0;
  const remainingMins = subData?.remainingAiMinutes || 0;

  return {
    totalCallDuration: {
      value: totalDurationFormatted,
      todayValue: todayDurationFormatted,
      todaySeconds: todayDurationInSeconds,
      totalSeconds: totalDurationInSeconds,
      change: calculateChange(currentPeriod.duration, previousPeriod.duration),
      weeklyChange:
        calculateWeeklyDiff(
          currentPeriod.duration / 60,
          previousPeriod.duration / 60,
        ) + " min",
    },
    todayTotalCall: {
      value: `Call ${todayCallCount}`,
      todayCallCount: todayCallCount,
      change: calculateChange(currentPeriod.count, previousPeriod.count),
      weeklyChange: calculateWeeklyDiff(
        currentPeriod.count,
        previousPeriod.count,
      ),
    },
    totalOrder: {
      value: totalOrderCount.toString(),
      today: (todayOrderStatsResult._count || 0).toString(),
      change: calculateChange(currentPeriod.orders, previousPeriod.orders),
      weeklyChange: calculateWeeklyDiff(
        currentPeriod.orders,
        previousPeriod.orders,
      ),
    },
    orderValue: {
      value: totalOrderValueResult._sum.totalPrice || 0,
      todayValue: todayOrderStatsResult._sum.totalPrice || 0,
      todayPriced: todayOrderStatsResult._count || 0,
    },
    usageOverview: {
      totalLimitMinutes: totalLimitMins,
      usedMinutes: usedMins,
      remainingMinutes: remainingMins,
    },
  };
};

/**
 * Get graph data for the last 14 days
 */
const getDashboardGraphData = async (userId) => {
  const business = await prisma.business.findFirst({
    where: { ownerId: userId },
  });

  if (!business) throw new Error("Business not found");

  const businessId = business.id;
  const last14Days = [];

  for (let i = 13; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const start = startOfDay(date);
    const end = endOfDay(date);

    const dayDuration = await prisma.call.aggregate({
      where: {
        businessId,
        startTime: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        duration: true,
      },
    });

    last14Days.push({
      date: format(date, "d MMM"),
      duration: Math.floor((dayDuration._sum.duration || 0) / 60), // in minutes
    });
  }

  return last14Days;
};

/**
 * Get overall report data
 */
const getOverallReport = async (userId) => {
  const business = await prisma.business.findFirst({
    where: { ownerId: userId },
  });

  if (!business) throw new Error("Business not found");

  const businessId = business.id;
  const totalCalls = await prisma.call.count({ where: { businessId } });
  const totalOrders = await prisma.order.count({ where: { businessId } });
  const totalDuration = await prisma.call.aggregate({
    where: { businessId },
    _sum: { duration: true },
  });

  // Calculate success rate (orders / total calls)
  const successRate =
    totalCalls > 0 ? Math.round((totalOrders / totalCalls) * 100) : 0;

  return {
    overallPercentage: successRate,
    totalCall: totalCalls,
    totalCallDuration: Math.floor((totalDuration._sum.duration || 0) / 60), // minutes
  };
};

let reportingOperations;
const getLiveOperations = async () => {
  reportingOperations ||= configuredOperations(prisma).catch((error) => {
    reportingOperations = null;
    throw error;
  });
  return (await reportingOperations).live();
};

const DAY_MS = 86400000;
const midnightDate = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};
const mondayDate = (value) => {
  const date = midnightDate(value);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date;
};
const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);

export function callSeries(rows, now = Date.now()) {
  const today = midnightDate(now);
  const thisWeek = mondayDate(now);
  const daily = Array.from({ length: 28 }, (_, i) => ({
    date: toDateKey(+today - (27 - i) * DAY_MS),
    calls: 0,
    failed: 0,
    minutes: 0,
  }));
  const weekly = Array.from({ length: 12 }, (_, i) => ({
    date: toDateKey(+thisWeek - (11 - i) * 7 * DAY_MS),
    calls: 0,
    failed: 0,
    minutes: 0,
  }));
  const days = new Map(daily.map((row) => [row.date, row]));
  const weeks = new Map(weekly.map((row) => [row.date, row]));

  for (const row of rows) {
    if (!Number.isFinite(Date.parse(row.date)) || new Date(row.date) > today) {
      continue;
    }
    for (const target of [
      days.get(toDateKey(row.date)),
      weeks.get(toDateKey(mondayDate(row.date))),
    ]) {
      if (target) {
        target.calls += Number(row.calls);
        target.failed += Number(row.failed);
        target.minutes += Number(row.seconds) / 60;
      }
    }
  }

  for (const row of [...daily, ...weekly]) {
    row.minutes = Math.round(row.minutes * 10) / 10;
  }
  return { daily, weekly };
}

export async function getOwnerInsights(
  prismaOrUserId = prisma,
  maybeUserId,
  maybeNow = Date.now(),
) {
  let prismaClient = prisma;
  let userId;
  let now = maybeNow;

  if (typeof prismaOrUserId === "string") {
    userId = prismaOrUserId;
    if (typeof maybeUserId === "number" || maybeUserId instanceof Date) {
      now = maybeUserId;
    }
  } else {
    if (prismaOrUserId) prismaClient = prismaOrUserId;
    userId = maybeUserId;
  }

  const business = await prismaClient.business.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!business) {
    const error = new Error("Business not found.");
    error.status = 404;
    throw error;
  }

  const businessId = business.id;
  const today = midnightDate(now);
  const start = new Date(+mondayDate(now) - 77 * DAY_MS);
  const end = new Date(+today + DAY_MS);
  const { start: londonTodayStart, end: londonTodayEnd } = getLondonDayBounds(now);

  const todayOrderPromise = (async () => {
    try {
      if (typeof prismaClient.order.aggregate === "function") {
        const res = await prismaClient.order.aggregate({
          where: {
            businessId,
            createdAt: { gte: londonTodayStart, lte: londonTodayEnd },
          },
          _sum: { totalPrice: true },
          _count: { _all: true, totalPrice: true },
        });
        return {
          count: res._count?._all ?? 0,
          value: res._sum?.totalPrice ?? (res._count?._all === 0 ? 0 : null),
          priced: res._count?.totalPrice ?? 0,
          unpriced: (res._count?._all ?? 0) - (res._count?.totalPrice ?? 0),
        };
      }
    } catch {
      // Fallback for test mocks
    }
    const count = await prismaClient.order.count({
      where: {
        businessId,
        createdAt: { gte: londonTodayStart, lte: londonTodayEnd },
      },
    });
    return {
      count: typeof count === "number" ? count : 0,
      value: null,
      priced: 0,
      unpriced: typeof count === "number" ? count : 0,
    };
  })();

  const [orders, todayOrdersData, failedCalls, rows] = await Promise.all([
    prismaClient.order.aggregate({
      where: { businessId },
      _sum: { totalPrice: true },
      _avg: { totalPrice: true },
      _count: { _all: true, totalPrice: true },
    }),
    todayOrderPromise,
    prismaClient.call.count({ where: { businessId, status: "failed" } }),
    prismaClient.$queryRaw`SELECT date_trunc('day', "startTime") AS date, count(*) AS calls,
      count(*) FILTER (WHERE status = 'failed') AS failed, coalesce(sum(duration),0) AS seconds
      FROM calls WHERE "businessId" = ${businessId}::uuid AND "startTime" >= ${start} AND "startTime" < ${end}
      GROUP BY 1 ORDER BY 1`,
  ]);

  return {
    generatedAt: new Date(now).toISOString(),
    timezone: "Europe/London",
    orders: {
      total: orders._count._all,
      today: todayOrdersData.count,
      priced: orders._count.totalPrice,
      unpriced: orders._count._all - orders._count.totalPrice,
      value: orders._sum.totalPrice ?? (orders._count._all === 0 ? 0 : null),
      todayValue: todayOrdersData.value,
      todayPriced: todayOrdersData.priced,
      todayUnpriced: todayOrdersData.unpriced,
      average: orders._avg.totalPrice,
      currency: "GBP",
    },
    failedCalls,
    ...callSeries(rows, now),
  };
}

export async function getOwnerLiveCalls(
  prismaOrUserId = prisma,
  maybeUserId,
  maybeGetLive = getLiveOperations,
) {
  let prismaClient = prisma;
  let userId;
  let getLive = maybeGetLive;

  if (typeof prismaOrUserId === "string") {
    userId = prismaOrUserId;
    if (typeof maybeUserId === "function") {
      getLive = maybeUserId;
    }
  } else {
    if (prismaOrUserId) prismaClient = prismaOrUserId;
    userId = maybeUserId;
  }

  const business = await prismaClient.business.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!business) {
    const err = new Error("Business not found.");
    err.status = 404;
    throw err;
  }

  const snapshot = await getLive();
  const calls = (snapshot.calls || []).filter(
    (call) => call.tenantId === business.id,
  );
  const active = calls.filter((call) => call.status === "in-progress");

  return {
    generatedAt: snapshot.generatedAt,
    complete: snapshot.complete,
    summary: {
      activeCalls: active.length,
      agentsInUse: new Set(active.map((call) => call.agentKey)).size,
      ringing: calls.filter((call) => call.status === "ringing").length,
      queued: calls.filter((call) => call.status === "queued").length,
      forwarding: calls.filter((call) => call.status === "forwarding").length,
    },
    calls: calls.map((call) => ({
      id: call.id,
      agentName: call.agentName,
      status: call.status,
      startedAt: call.startedAt,
    })),
  };
}

export const DashboardService = {
  getDashboardStats,
  getDashboardGraphData,
  getOverallReport,
  getOwnerInsights,
  getOwnerLiveCalls,
  callSeries,
};
