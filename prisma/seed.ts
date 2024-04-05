import { MemberLevelDefinition, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { encodePassword } from "~/server/core/utils";

/**
 * 数据库初始化脚本
 * 命令执行yarn run db:seed 或 yarn prisma db seed
 */

const prisma = new PrismaClient();

/**
 * 从 github 获取各国家电话区码插入phone_area_code表
 * @returns void
 */
async function updatePhoneAreaCode() {
  const count = await prisma.phoneAreaCode.count();
  if (count > 0) {
    return;
  }

  const URL_STRING =
    "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/countries.json";

  const result = await fetch(URL_STRING);

  // 打印请求返回json，根据 json 结构定义 CountriesSchema 变量
  // console.log(await result.json())

  const CountriesSchema = z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      iso2: z.string(),
      translations: z.object({
        cn: z.string(),
      }),
      phone_code: z.string(),
      emoji: z.string(),
    }),
  );

  const schema = CountriesSchema.parse(await result.json());
  await prisma.phoneAreaCode.createMany({
    data: schema.map(
      ({ id, name, iso2, translations: { cn }, phone_code, emoji }) => ({
        id,
        englishName: name,
        chineseName: cn,
        countryCode: iso2,
        phoneCode: phone_code,
        emoji,
        mix: `${name}${cn}${iso2}${phone_code}`,
      }),
    ),
  });
}

/**
 * 为 RestaurantRegion 表插入18个行政区的数据
 */
async function updateRestaurantRegions() {
  const count = await prisma.restaurantRegion.count();
  if (count > 0) {
    return;
  }

  // 定义行政区数据
  const regionsData = [
    {
      regionCode: "01",
      regionName: "中西區",
      regionEnName: "Central and Western District",
    },
    { regionCode: "02", regionName: "東區", regionEnName: "Eastern District" },
    { regionCode: "03", regionName: "南區", regionEnName: "Southern District" },
    {
      regionCode: "04",
      regionName: "灣仔區",
      regionEnName: "Wan Chai District",
    },
    {
      regionCode: "05",
      regionName: "九龍城區",
      regionEnName: "Kowloon City District",
    },
    {
      regionCode: "06",
      regionName: "觀塘區",
      regionEnName: "Kwun Tong District",
    },
    {
      regionCode: "07",
      regionName: "深水埗區",
      regionEnName: "Sham Shui Po District",
    },
    {
      regionCode: "08",
      regionName: "黃大仙區",
      regionEnName: "Wong Tai Sin District",
    },
    {
      regionCode: "09",
      regionName: "油尖旺區",
      regionEnName: "Yau Tsim Mong District",
    },
    {
      regionCode: "10",
      regionName: "離島區",
      regionEnName: "Islands District",
    },
    {
      regionCode: "11",
      regionName: "葵青區",
      regionEnName: "Kwai Tsing District",
    },
    { regionCode: "12", regionName: "北區", regionEnName: "North District" },
    {
      regionCode: "13",
      regionName: "西貢區",
      regionEnName: "Sai Kung District",
    },
    {
      regionCode: "14",
      regionName: "沙田區",
      regionEnName: "Sha Tin District",
    },
    { regionCode: "15", regionName: "大埔區", regionEnName: "Tai Po District" },
    {
      regionCode: "16",
      regionName: "荃灣區",
      regionEnName: "Tsuen Wan District",
    },
    {
      regionCode: "17",
      regionName: "屯門區",
      regionEnName: "Tuen Mun District",
    },
    {
      regionCode: "18",
      regionName: "元朗區",
      regionEnName: "Yuen Long District",
    },
  ];

  // 然后按照之前提供的Prisma脚本插入数据

  await prisma.restaurantRegion.createMany({
    data: regionsData.map((region) => ({
      code: region.regionCode,
      name: region.regionName,
      en_name: region.regionEnName,
      createBy: 0,
      updateBy: 0,
      createAt: new Date(),
      updateAt: new Date(),
      deleteAt: 0,
    })),
  });
}

async function updateGlobalConfigDefault() {
  const config = await prisma.globalConfig.findUnique({ where: { id: 1 } });
  if (config) {
    return;
  }

  await prisma.globalConfig.create({
    data: {
      pointsName: "snpax",
      bonusPointsRangeStart: 10000,
      bonusPointsRangeEnd: 100000,
      pushFeeSms: 150,
      pushFeeApp: 100,
    },
  });
}

async function initSysUser() {
  const count = await prisma.sysUser.count();
  if (count > 0) {
    return;
  }

  const password = await encodePassword("123456");
  await prisma.sysUser.create({
    data: { name: "Admin", username: "admin", enabled: true, password },
  });
}

async function initMemberLevelDefinition() {
  const count = await prisma.memberLevelDefinition.count();
  if (count > 0) {
    return;
  }
  const data = [
    {
      name: "普通",
      en_name: "GENERAL",
      levelCode: "LV_GENERAL",
      bonusMultiple: 1,
      keepLevelDays: 0,
      keepLevelTimes: 0,
      toLevelDays: 0,
      toLevelTimes: 0,
      nextLevelCode: "LV_RED",
      backLevelCode: "LV_GENERAL",
    },
    {
      name: "紅色",
      en_name: "RED",
      levelCode: "LV_RED",
      bonusMultiple: 2,
      keepLevelDays: 15,
      keepLevelTimes: 1,
      toLevelDays: 10,
      toLevelTimes: 2,
      nextLevelCode: "LV_GOLD",
      backLevelCode: "LV_GENERAL",
    },
    {
      name: "金色",
      en_name: "GOLD",
      levelCode: "LV_GOLD",
      bonusMultiple: 2,
      keepLevelDays: 10,
      keepLevelTimes: 1,
      toLevelDays: 10,
      toLevelTimes: 5,
      backLevelCode: "LV_GENERAL",
    },
  ];
  await prisma.memberLevelDefinition.createMany({ data });
}

async function main() {
  await initSysUser();
  await updateRestaurantRegions();
  await updatePhoneAreaCode();
  await updateGlobalConfigDefault();
  await initMemberLevelDefinition();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
