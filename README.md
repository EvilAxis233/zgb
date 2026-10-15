# 诸告板

跑团招募与结团凭证网站。前端使用 React/Vite；`functions/api/[[path]].js` 是 Cloudflare Pages Functions API，D1 保存业务数据，R2 保存团封面。

## 本地开发

需要 Node.js 22 和 Wrangler。运行 `npm ci`、`npm run db:migrate:local`、`npm run build`，然后运行 `npm run dev:pages`。Pages Functions 与本地 D1/R2 由 Wrangler 启动；单独运行 `npm run dev` 只适合查看静态 UI。

若要测试登录，在未提交的 `.dev.vars` 中设置 `RESEND_API_KEY` 和 `OTP_SECRET`。`RESEND_API_KEY` 是 Resend API 密钥；`OTP_SECRET` 是独立随机密钥，用于验证码 HMAC。邮件发送地址默认 `诸告板 <login@mail.dhvault.top>`。不要把任何密钥加入 Git。

## 数据与接口

初始 D1 为空，不自动导入演示账号或团。登录时输入 QQ 号，后端向 `<QQ号>@qq.com` 发送六位验证码，十分钟有效；单号 60 秒内不可重发，每小时最多五次，同一 IP 每小时最多二十次；一个验证码最多尝试五次。登录成功后建立 30 天的 HttpOnly 会话。该流程验证 QQ 邮箱收件能力，不是腾讯 QQ OAuth。

主要 API 在同源 `/api` 下：`auth/request-code`、`auth/verify`、`auth/me`、`auth/logout`、`campaigns`、`campaigns/:id/status`、`campaigns/:id/voucher`、`redeem`、`profile`、`checkin`、`praise`、`upload`。写操作以会话身份执行；公开团列表不返回凭证码。每日签到以香港日期为准。凭证生成时将预计人数固定为领取上限；每名用户每团仅可领取一次。删除团采用软删除，历史记录仍可查询。

`migrations/` 为 D1 模式文件。`users.qq` 是不可修改的身份主键。`campaigns.max_players` 是展示的预计人数，`voucher_limit` 在生成时从它复制；不维护实时报名人数。`participations` 和 `praises` 留存发放与消耗记录。站点清空浏览器数据不影响这些服务器记录。

## 生产部署

GitHub 仓库为 [dqqql/zgb](https://github.com/dqqql/zgb)，生产地址为 [zgb-trpg.pages.dev](https://zgb-trpg.pages.dev)。Cloudflare Pages 项目 `zgb-trpg` 连接该仓库，生产分支 `main`，构建命令 `npm run build`，输出目录 `dist`。推送 `main` 会自动部署生产；其他分支使用预览部署。`wrangler.jsonc` 保存 D1/R2 绑定，远端迁移运行 `npm run db:migrate:remote`。

在 Pages 生产环境设置加密 Secret：`RESEND_API_KEY` 与 `OTP_SECRET`。`RESEND_FROM` 在 `wrangler.jsonc` 中设置。配置后重新部署并验证 `/api/health`、空首页、实际 QQ 邮件和登录。不要在预览环境复用生产 Secret 或向真实用户发送测试验证码。`OTP_SECRET` 已单独生成并配置；`RESEND_API_KEY` 待配置。

此前用于释放 D1 配额的旧 `ssjz` 数据库已备份至本机 `backups/ssjz-2026-10-15.sql`；该目录被 Git 忽略。旧 `ssjz` Pages 项目仍存在，但原 D1 绑定已失效。
