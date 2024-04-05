import { redis } from "~/server/redis";
import moment from "moment";
import { v4 as uuid } from "uuid";

const expireSecound = 7 * 24 * 60 * 60 * 1000;

export enum SessionApp {
  ADMIN = "ADMIN",
  CUSTOMER = "CUSTOMER",
  RESTAURANT = "RESTAURANT",
}

export interface UserSession {
  id: string;
  userId: number;
  brandId?: number;
  restaurantId?: number;
  account: string;
  createAt: Date;
  updateAt: Date;
  expireAt: Date;
  store?: Record<string, unknown>;
}

export const useSession = (app: SessionApp) => {
  const keyBuilder = getKeyBuilder(app);

  const find = async (id: string) => {
    const key = keyBuilder(id);
    const data = await redis.hGetAll(key);
    return (
      data &&
      ({
        id: data.id,
        userId: Number(data.userId),
        brandId: Number(data.brandId),
        restaurantId: Number(data.restaurantId),
        account: data.account,
        createAt: toDate(data.createAt),
        updateAt: toDate(data.updateAt),
        expireAt: toDate(data.expireAt),
        store: JSON.parse(data.store ?? "{}"),
      } as UserSession)
    );
  };

  const update = async ({
    id,
    session,
  }: {
    id?: string;
    session: Omit<UserSession, "id" | "createAt" | "updateAt" | "expireAt">;
  }) => {
    const now = new Date();
    const sessionId = id || uuid();
    const key = keyBuilder(sessionId);
    const existed = await find(sessionId);
    const { userId, account, brandId, restaurantId, createAt, store } = {
      ...(existed ?? {}),
      ...session,
    };
    const updateAt = createAt ? new Date() : now;
    const expireAt = new Date(updateAt.getTime() + expireSecound);
    await redis.hSet(key, {
      id: sessionId,
      userId: String(userId),
      account: account,
      brandId: String(brandId ?? ""), // 将可选的 number 转换为字符串
      restaurantId: String(restaurantId ?? ""), // 同样处理 restaurantId
      createAt: formatDate(createAt ?? now),
      updateAt: formatDate(updateAt),
      expireAt: formatDate(expireAt),
      store: JSON.stringify(store),
    });
    await redis.expire(key, expireSecound);
    return await find(sessionId);
  };

  const remove = async (id: string) => {
    const key = keyBuilder(id);
    const existed = await find(id);
    await redis.del(key);
    return existed;
  };

  const isValid = (session: UserSession) => {
    return session && session.expireAt > new Date();
  };

  return {
    find,
    update,
    remove,
    isValid,
  };
};

const getKeyBuilder = (app: SessionApp) => (id: string) =>
  `USER_SESSION:${app}:${id}`;

const DATE_FORMATE = "YYYY-MM-DD HH:mm:ss";
const toDate = (date?: string) => moment(date, DATE_FORMATE).toDate();
const formatDate = (date: Date) => moment(date).format(DATE_FORMATE);
