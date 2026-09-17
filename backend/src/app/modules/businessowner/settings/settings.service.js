import prisma from "../../../prisma/client.js";
import { syncBusinessAgentStatus } from "../../../utils/workingHoursScheduler.js";
import { StatusCodes } from "http-status-codes";
import DevBuildError from "../../../lib/DevBuildError.js";

const updateProfileInDB = async (userId, data) => {
  return await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
    },
  });
};

const getProfileFromDB = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
    },
  });
};

const getContactInfoFromDB = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
    },
  });
};

const updatePhoneInDB = async (userId, phone) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { phone },
  });
};

const getBusinessDetailsFromDB = async (userId) => {
  const business = await prisma.business.findFirst({
    where: { ownerId: userId },
    include: { businessSettings: true },
  });

  if (!business) {
    return null;
  }

  return {
    name: business.name,
    address: business.businessSettings?.businessAddress || "",
    openingTime: business.businessSettings?.openingTime || null,
    closingTime: business.businessSettings?.closingTime || null,
    offDays: business.businessSettings?.offDays || [],
  };
};

const updateBusinessDetailsInDB = async (userId, data) => {
  const business = await prisma.business.findFirst({
    where: { ownerId: userId },
  });

  if (!business) {
    throw new DevBuildError("Business not found", StatusCodes.NOT_FOUND);
  }

  const updatedBusiness = await prisma.$transaction(async (tx) => {
    const updatedBusiness = await tx.business.update({
      where: { id: business.id },
      data: data.name !== undefined ? { name: data.name } : {},
    });

    await tx.businessSetting.upsert({
      where: { businessId: business.id },
      update: {
        ...(data.name !== undefined ? {businessName:data.name} : {}),
        ...(data.address !== undefined ? {businessAddress:data.address} : {}),
        ...(data.openingTime !== undefined ? {openingTime:data.openingTime} : {}),
        ...(data.closingTime !== undefined ? {closingTime:data.closingTime} : {}),
        ...(data.offDays !== undefined ? {offDays:data.offDays} : {}),
      },
      create: {
        businessId: business.id,
        businessName: data.name || updatedBusiness.name,
        businessAddress: data.address || "",
        openingTime: data.openingTime || null,
        closingTime: data.closingTime || null,
        offDays: data.offDays || [],
      },
    });

    return updatedBusiness;
  });
  if (data.openingTime !== undefined || data.closingTime !== undefined || data.offDays !== undefined) {
    await syncBusinessAgentStatus(business.id);
  }
  return updatedBusiness;
};

export const SettingsService = {
  updateProfileInDB,
  getProfileFromDB,
  getContactInfoFromDB,
  updatePhoneInDB,
  getBusinessDetailsFromDB,
  updateBusinessDetailsInDB,
};
