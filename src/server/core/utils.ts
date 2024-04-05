import * as bcrypt from "bcryptjs";
import _ from "lodash";
import crypto from "crypto";
import { Decorator, type AppRouterContext } from "./schema";

export const encodePassword = async (password: string) =>
  (await bcrypt.hash(_.trim(password), 10)) as string;

export const comparePassword = async (
  password: string,
  member: { password: string | null },
) =>
  password &&
  member.password &&
  (await bcrypt.compare(password, member.password));

export const asAccount = ({
  phoneAreaCode,
  phone,
}: {
  phoneAreaCode: string;
  phone: string;
}) => `${phoneAreaCode}-${phone}`;

export const adapter = <T>(target: (arg: T) => any, presets: Partial<T>) => {
  return async (options: Partial<T>) =>
    await target({
      ...presets,
      ...options,
    } as T);
};

export const combind = <T>(...handlers: ((t: T) => any)[]) =>
  ((params: T) =>
    handlers.reduce(
      async (pre: Promise<T>, cur: (t: T) => any) => cur(await pre),
      Promise.resolve(params),
    )) as (t: T) => any;

export const decorate = <IN extends any[], OUT>(
  f: (...args: IN) => Promise<OUT>,
  ...decorator: Decorator[]
) => decorator.reduce((prev, cur) => cur(prev), f);

export const generateUniqueString = (length: number = 16): string => {
  const allowedChars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  while (result.length < length) {
    const randomByte = crypto.randomInt(0, allowedChars.length);
    result += allowedChars[randomByte];
  }
  return result;
};

export const getRandomNumber = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

export const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const addDaysToDate = (date: Date, daysToAdd: number) => {
  let newDate = new Date(date.valueOf()); // 创建原日期的一个副本
  newDate.setDate(newDate.getDate() + daysToAdd); // 在当前天数上加上指定的天数
  return newDate;
};

export const generateRandomSixDigitsWithPrefix = (): string => {
  const randomNumber = getRandomInt(100000, 999999);

  // 将数字转换为字符串，并在前面添加"SX"
  const randomStringWithPrefix = `SX${randomNumber.toString()}`;

  return randomStringWithPrefix;
};
