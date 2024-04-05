import { z } from "zod";
import _ from "lodash";
import {
  TRPCError,
  type inferRouterContext,
  type inferRouterInputs,
  type inferRouterOutputs,
} from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/admin/trpc";
import { comparePassword, encodePassword } from "~/server/core/utils";
import { SysUser } from "@prisma/client";
import { DATA_NOT_EXIST, UNAUTHORIZED } from "~/server/core/error";
import { SessionApp, useSession } from "~/server/session";

type RouterContext = inferRouterContext<ReturnType<typeof createTRPCRouter>>;
type CreateSysUserInput = inferRouterInputs<
  typeof sysUserRouter
>["createSysUser"];

const CreateSysUserInputSchema = z
  .object({
    name: z
      .string()
      .min(1, "Missing admin name")
      .max(32, "Admin name too long"),
    username: z
      .string()
      .min(1, "Missing admin username")
      .max(64, "Admin username too long"),
    password: z.string().min(1, "Missing password"),
    confirmPassword: z.string().min(1, "Mising password confirm"),
    phone: z.string().optional(),
    mail: z.string().email("Incorrect email format").optional(),
    remark: z.string().max(255, "Remark too long").optional(),
    enabled: z.boolean().optional(),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Two passwords must match",
    path: ["confirmPassword"],
  });

const UpdateSysUserInputSchema = z
  .object({
    name: z
      .string()
      .min(1, "Missing admin name")
      .max(32, "Admin name too long"),
    username: z
      .string()
      .min(1, "Missing admin username")
      .max(64, "Admin username too long"),
    password: z.string().nullish(),
    confirmPassword: z.string().nullish(),
    phone: z.string().nullish(),
    mail: z.string().email("Incorrect email format").nullish(),
    remark: z.string().max(255, "Remark too long").nullish(),
    enabled: z.boolean(),
  })
  .refine(
    ({ password, confirmPassword }) =>
      password === confirmPassword || (!password && !confirmPassword),
    {
      message: "Two passwords must match",
      path: ["confirmPassword"],
    },
  );

const { update: updateSession, remove: removeSession } = useSession(
  SessionApp.ADMIN,
);

export const sysUserRouter = createTRPCRouter({
  auth: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { username, password } }) => {
      const sysUser = await ctx.db.sysUser.findUnique({ where: { username } });
      if (!sysUser) {
        throw DATA_NOT_EXIST();
      }
      if (!(await comparePassword(password, sysUser))) {
        throw UNAUTHORIZED();
      }

      const session = await updateSession({
        session: { userId: sysUser.id, account: sysUser.username },
      });

      const { password: _, ...rest } = sysUser;

      return { ...rest, token: session.id };
    }),
  createSysUser: protectedProcedure
    .input(CreateSysUserInputSchema)
    .mutation(async ({ ctx, input }) => {
      await isUsernameDuplicate(ctx, input);
      await isPhoneDuplicate(ctx, input);
      await isMailDuplicate(ctx, input);

      const password = await encodePassword(input.password);
      const { confirmPassword, ...data } = input;
      const result = await ctx.db.sysUser.create({
        data: { ...data, password },
      });
      const { password: x, ...rest } = result;
      return rest;
    }),

  deleteSysUser: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sysUser = await ctx.db.sysUser.findUnique({
        where: { id: input.id },
      });
      if (!sysUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Admin with id ${input.id} is not found`,
        });
      }

      const result = await ctx.db.sysUser.delete({ where: { id: input.id } });
      const { password: x, ...rest } = result;
      return rest;
    }),

  updateSysUser: protectedProcedure
    .input(z.object({ id: z.number(), data: UpdateSysUserInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const sysUser = await ctx.db.sysUser.findUnique({
        where: { id: input.id },
      });
      if (!sysUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Admin with id ${input.id} is not found`,
        });
      }

      let data = { ...input.data, password: sysUser.password };
      if (input.data.password && input.data.confirmPassword) {
        const password = await encodePassword(input.data.password);
        const { confirmPassword, ...rest } = input.data;
        data = { ...rest, password };
      }

      const result = await ctx.db.sysUser.update({
        data,
        where: { id: input.id },
      });
      const { password: x, ...rest } = result;
      return rest;
    }),

  findSysUserById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) => {
      const result = await db.sysUser.findUnique({ where: { id } });
      if (!result) {
        return null;
      }
      const { password, ...rest } = result;
      return rest;
    }),

  querySysUser: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        name: z.string().optional(),
        username: z.string().optional(),
        phone: z.string().optional(),
        mail: z.string().optional(),
        createTimeStart: z.date().optional(),
        createTimeEnd: z.date().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input: { page, pageSize, ...input } }) => {
      const where = {
        name: {
          contains: input.name,
        },
        username: {
          contains: input.username,
        },
        phone: {
          contains: input.phone,
        },
        mail: {
          contains: input.mail,
        },
        createAt: {
          gte: input.createTimeStart,
          lte: input.createTimeEnd,
        },
        enabled: input.enabled,
      };
      const total = await ctx.db.sysUser.count({ where });
      const totalPage = Math.ceil(total / pageSize);
      if (total == 0) {
        return {
          page,
          pageSize,
          total,
          totalPage,
          record: [],
        };
      }
      const record = (
        await ctx.db.sysUser.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where,
        })
      ).map(({ password, ...rest }) => rest);
      return {
        page,
        pageSize,
        total,
        totalPage,
        record,
      };
    }),
});

async function isUsernameDuplicate(
  { db }: RouterContext,
  { username }: CreateSysUserInput,
) {
  if (_.isEmpty(username)) {
    return;
  }
  const existUser = await db.sysUser.findUnique({
    where: { username },
  });
  if (existUser) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Admin with username ${username} is exist`,
    });
  }
}

async function isPhoneDuplicate(
  { db }: RouterContext,
  { phone }: CreateSysUserInput,
) {
  if (_.isEmpty(phone)) {
    return;
  }
  const existUser = await db.sysUser.findUnique({
    where: { phone },
  });
  if (existUser) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Admin with phone ${phone} is exist`,
    });
  }
}

async function isMailDuplicate(
  { db }: RouterContext,
  { mail }: CreateSysUserInput,
) {
  if (_.isEmpty(mail)) {
    return;
  }
  const existUser = await db.sysUser.findUnique({
    where: { mail },
  });
  if (existUser) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Admin with mail ${mail} is exist`,
    });
  }
}
