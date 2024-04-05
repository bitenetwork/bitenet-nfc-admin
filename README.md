# 项目说明

## 启动项目

拉取代码后执行以下命令

```bash
# 相当于 npm install，安装所有依赖
yarn

# 执行 Prisma 的脚本生成 数据库 DAO 代码
yarn run postinstall

# 启动项目
yarn run dev
```

项目启动后可以访问下面几个地址

- 客户端接口文档

  - http://localhost:3000/swagger-ui/customer

- 餐厅端接口文档

  - http://localhost:3000/swagger-ui/restaurant

- 管理后台

  - http://localhost:3000/system/sys-user

## API接口开发流程

### 表结构定义

在 prisma/schema.prisma 中添加表结构定义 后执行以下命令

```bash
# 按照prisma/schema.prisma定义在数据中生成表结构
yarn run db:push

# 按照prisma/schema.prisma定义生成 DAO 代码
yarn run postinstall
```

### 接口路由定义

在应用目录（server/admin 或 server/customer 或 server/restaurant） 的 routers 目录下创建ts文件

```ts
import { z } from "zod";
// 导入 trpc 路由定义函数
import { createTRPCRouter, publicProcedure } from "../trpc";

// 定义接口前缀路径
const PATH_PREFIX = "/member/auth";

// Swagger 接口标签分组定义
export const TAG = "1000 - 会员";

// 导出一个路由定义
export const memberRouter = createTRPCRouter({

  // 定义一个接口
  createMember: publicProcedure
    .meta({
      openapi: {
        // Swagger 定义
        method: "POST",
        path: `${PATH_PREFIX}/create-member`,
        tags: [TAG],
        summary: "创建用户",
      },
    })
    // 入参定义
    .input(z.object({
      nickname: z.string()..describe("昵称"),
      account: z.string()..describe("账号"),
    }))
    // 出参定义
    .output(z.object({
      id: z.number().describe("主键"),
      nickname: z.string().describe("昵称"),
      account: z.string().describe("账号"),
    }))
    // 接口实现，POST 接口用mutation，GET 接口用 query
    .mutation(async ({ctx /**请求上下文 */, input /**前端提交参数对象 */,}) => {
      return await ctx.db.member.create({data: input});
    }),

  // 定义另外一个接口
  listMember: publicProcedure
    .meta({
      openapi: {
        // Swagger 定义
        method: "GET",
        path: `${PATH_PREFIX}/list-member`,
        tags: [TAG],
        summary: "查询用户列表",
      },
    })
    // 入参定义
    .input(z.object({
      nickname: z.string()..describe("昵称"),
      account: z.string()..describe("账号"),
    }))
    // 出参定义
    .output(
      z.array(
        z.object({
          id: z.number().describe("主键"),
          nickname: z.string().describe("昵称"),
          account: z.string().describe("账号"),
        }),
      ),
    )
    // 接口实现，POST 接口用mutation，GET 接口用 query
    .query(async ({ctx /**请求上下文 */, input /**前端提交参数对象 */,}) => {
      return await ctx.db.member.findMany({where: {
        nickname: {
          contains: input.nickname,
        },
        account: {
          contains: input.account,
        },
      }});
    }),

})
```

在应用目录（server/admin 或 server/customer 或 server/restaurant） 的root.ts中注册新加的路由

```ts
import { memberRouter, TAG as TAG_MEMBER } from "./routers/member";
import { createTRPCRouter } from "./trpc";

export const ALL_TAG = [TAG_MEMBER];

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  member: memberRouter, // 前面创建的路由
});

// export type definition of API
export type AppRouter = typeof appRouter;
```

## 项目依赖

- TypeScript - 编程语言

  - https://www.tslang.cn/docs/home.html

- Creat T3 App - 项目模版脚手架

  - https://create.t3.gg/zh-hans/introduction

- Prisma - ORM框架

  - https://www.prisma.io/docs/getting-started/quickstart

- tRPC - Web/RPC 框架

  - https://trpc.io/docs/quickstart

- trpc-openapi - tRPC增强，导出tRPC路由为 Rest API 接口，供非nodejs 环境客户端使用，导出 Swagger 文档

  - https://github.com/jlalmes/trpc-openapi

- zod - TypeScript类型定义校验框架

  - https://zod.dev/

- Lodash - JS 实用工具库

  - https://www.lodashjs.com/

- Moment.js - JS 日期库

  - https://momentjs.com/

- React - 前端响应式框架

  - https://zh-hans.react.dev/learn

- Next.js - React 框架 / SSR / 服务端运行时

  - https://nextjs.org/docs

- Ant Design - React UI组件库
  - https://ant-design.antgroup.com/components/overview-cn/

## 目录结构

- prisma - 数据库结构定义
- public - 静态文件
- src
  - app - 前端代码（Next.js）
  - page - 前端代码（Next.js）
  - server - 服务端代码
    - admin - 管理后台接口路由
    - customer - 客户端接口路由
    - restaurant - 餐厅端接口路由
  - style - 样式文件
  - theme - 主题定义
  - trpc - tRPC前后端公共依赖
  - env.mjs - 环境变量结构定义
- .env - 环境变量

## 部署说明

代码合并到dev分支并推送到码云，会触发码云CI构建docker镜像并推送到docker.io

docker.io接收到镜像推送后会向我们配置的地址发送webhook

我们服务器接收webhook并执行shell脚本拉取镜像重启服务

### 构建

- 在码云中配置流水线([Gitee GO](https://gitee.com/digcoin/nfc/gitee_go/pipelines))，项目会多次一个.workflow文件夹，里面是流水线的yml格式配置
- 流水线使用根目录Dockerfile构建docker镜像，并推送到Docker Hub，需要使用Docker Hub 凭证
- 在流水线中配置自动触发事件：Push事件，精确匹配分支名：dev

### Docker Hub 凭证

- 登录自己的Docker Hub 账户，在[security](https://hub.docker.com/settings/security)中创建access token
- 登录码云账户，在[凭证管理](https://gitee.com/organizations/digcoin/credentials)中创建Docker Registry类型凭证

### Webhook

- 在Github项目[webhook](https://github.com/adnanh/webhook)主页下载二进制可执行文件
- 在部署服务器上启动webhook --hooks hooks.yml, 默认监听9000端口
- 修改nginx配置，把 /hooks 请求代理到 9000端口
- 在Docker Hub上配置webhook地址为https://nfc.snapx.io/hooks/handle-nfc-docker-push（部署的目标服务器域名）
- 部署日志可以在/app/log/webhook/webhook.log中查看

```yml
# hooks.yml 文件内容
- id: handle-nfc-docker-push
  execute-command: /app/srv/nfc/restart.sh
  command-working-directory: /app/srv/nfc
```
