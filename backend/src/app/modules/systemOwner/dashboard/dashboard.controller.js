import { StatusCodes } from "http-status-codes";
import { DashboardService } from "./dashboard.service.js";
import DevBuildError from "../../../lib/DevBuildError.js";

const handleError = (res, error) => {
  console.error("Dashboard Error:", error);
  if (error instanceof DevBuildError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: "An internal server error occurred",
  });
};

const getDashboardStats = async (req, res) => {
  try {
    const result = await DashboardService.getDashboardStatsFromDB();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Dashboard statistics fetched successfully",
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getOperationsReport = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const data = await DashboardService.getOperationsReport(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.status === 400 ? 400 : 503).json({
      success: false,
      message:
        error.status === 400
          ? error.message
          : "Admin reports are temporarily unavailable. Please retry.",
    });
  }
};

const getLiveOperations = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const data = await DashboardService.getLiveOperations();
    return res.json({ success: true, data });
  } catch {
    return res.status(503).json({
      success: false,
      message: "Live usage is temporarily unavailable. Please retry.",
    });
  }
};

export const DashboardController = {
  getDashboardStats,
  getOperationsReport,
  getLiveOperations,
};
