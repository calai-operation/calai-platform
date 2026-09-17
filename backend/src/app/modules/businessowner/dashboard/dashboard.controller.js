import { DashboardService } from "./dashboard.service.js";
import { sendResponse } from "../../../utils/sendResponse.js";
import { StatusCodes } from "http-status-codes";

/**
 * Get dashboard stats
 */
const getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const stats = await DashboardService.getDashboardStats(userId);
    const graphData = await DashboardService.getDashboardGraphData(userId);
    const overallReport = await DashboardService.getOverallReport(userId);

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Dashboard data retrieved successfully",
      data: {
        stats,
        graphData,
        overallReport,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get owner insights (order summaries, call series trends)
 */
const getInsights = async (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const userId = req.user.id;
    const data = await DashboardService.getOwnerInsights(userId);
    return res.status(StatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (error) {
    return res
      .status(
        error.status === 404
          ? StatusCodes.NOT_FOUND
          : StatusCodes.SERVICE_UNAVAILABLE,
      )
      .json({
        success: false,
        message:
          error.status === 404
            ? "Business not found."
            : "Business insights are temporarily unavailable.",
      });
  }
};

/**
 * Get owner live calls (active, ringing, queued calls for business)
 */
const getLiveCalls = async (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const userId = req.user.id;
    const data = await DashboardService.getOwnerLiveCalls(userId);
    return res.status(StatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (error) {
    return res
      .status(
        error.status === 404
          ? StatusCodes.NOT_FOUND
          : StatusCodes.SERVICE_UNAVAILABLE,
      )
      .json({
        success: false,
        message:
          error.status === 404
            ? "Business not found."
            : "Live call updates are temporarily unavailable.",
      });
  }
};

export const DashboardController = {
  getStats,
  getInsights,
  getLiveCalls,
};
