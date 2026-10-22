# 诸告板

跑团招募、成员管理与团内点赞网站。前端使用 React/Vite；`functions/api/[[path]].js` 是 Cloudflare Pages Functions API，D1 保存业务数据，R2 保存团封面和用户头像。

## 本地开发

需要 Node.js 22 和 Wrangler。运行 `npm ci`、`npm run db:migrate:local`、`npm run build`，然后运行 `npm run dev:pages`。Pages Functions 与本地 D1/R2 由 Wrangler 启动；单独运行 `npm run dev` 只适合查看静态 UI。

若要测试登录，在未提交的 `.dev.vars` 中设置 `RESEND_API_KEY` 和 `OTP_SECRET`。`RESEND_API_KEY` 是 Resend API 密钥；`OTP_SECRET` 是独立随机密钥，用于验证码 HMAC。另需为后台设置 `ADMIN_PASSWORD`，机器人测试桥接设置 `BOT_BRIDGE_TOKEN`。邮件发送地址默认 `诸告板 <login@mail.dhvault.top>`。不要把任何密钥加入 Git。

## 数据与接口

初始 D1 为空，不自动导入演示账号或团。登录时输入 QQ 号，后端向 `<QQ号>@qq.com` 发送六位验证码，十分钟有效；单号 60 秒内不可重发，每小时最多五次，同一 IP 每小时最多二十次；一个验证码最多尝试五次。登录成功后建立 30 天的 HttpOnly 会话。该流程验证 QQ 邮箱收件能力，不是腾讯 QQ OAuth。

主要 API 在同源 `/api` 下：`auth/request-code`、`auth/verify`、`auth/me`、`auth/logout`、`campaigns`、`campaigns/:id`、`campaigns/:id/signup`、`campaigns/:id/members/:qq`、`campaigns/:id/finish`、`profile`、`profile/avatar`、`checkin`、`praise`、`upload`。写操作以会话身份执行。公开团列表只返回未锁车、未结团且未满员的团；其余团仅对 GM 和已报名玩家保留。弃团会删除该团、成员记录和团内点赞。

`migrations/` 为 D1 模式文件。`users.qq` 是不可修改的身份主键；`users.avatar_key` 指向 R2 头像。`campaign_memberships` 是参团记录的唯一来源，`campaigns.max_players` 不包含 GM。只有主持手动结团后，该团才进入成员个人档案；每日签到按香港日期获得玩家点赞券，连续签到每满七天获得 1 枚 GM 点赞券。团内点赞必须绑定已结团的团，且只能由该团成员发出。举报须指定站内昵称或 QQ 号，后台按被举报账号统计次数；黑名单支持限时或永久生效，生效期间禁止报名，手动移出后再次加入会重新计时。预定日期过后自动锁车；修改单团时间到未来后，主持可手动重新开放。站点清空浏览器数据不影响这些服务器记录。

批量发布时，每个日期与时段分别创建独立的 `campaigns` 记录，使用 `batch_id` 供板块列表合并展示和详情切换。`kind` 区分网团、面团和宣群；旧记录默认网团。三个板块分别展示，均进入同一机器人广播队列，事件包含 `kind`。面团使用一个输入框填写省份和城市，合计最多八个字；完整地址另填，并在卡片标签下方展示。旧面团分开保存的省份和城市仍会合并展示。宣群使用自填平台及预设或自填方式。宣群无结团操作，锁车后从板块隐藏。网团发布日历仍限 31 天，面团和宣群可选择任意未来日期。报名、成员、点赞、锁车、结团与弃团按单条记录处理；批量团的简介和标签统一修改，一个批次只写入一条广播事件。部署前须应用 `0009_campaign_batches.sql`、`0010_campaign_closure.sql`、`0012_campaign_completion.sql`、`0013_campaign_sections.sql`、`0014_offline_province.sql`、`0015_feedback_reports.sql`、`0016_checkin_streak.sql` 和 `0017_reports_blacklist.sql`。

团务管理将批量团折叠成一个主团；主团保存通用信息，新增时间点从该信息复制。主团的“修改”可同步所有时段的简介和标签，并更新之后新增时段的模板；各时段仍可单独锁车、结团或弃团。主团在团务管理中保持可见；个人档案仅逐团记录已结团的时段。已有批量团通过 `0011_campaign_batch_templates.sql` 补建主团信息，部署新版 Functions 前需先应用此迁移。

## 管理后台

访问 `/admin`。后台密码从 Pages Secret `ADMIN_PASSWORD` 读取；未配置时后台登录不可用。后台使用独立的 HttpOnly、Secure、SameSite=Strict Cookie，会话有效期 12 小时；单个 IP 15 分钟内连续五次输错后会暂时拒绝登录。更换密码会使旧管理员会话失效；原来公开于源码的密码不得继续使用。

后台首页为数据看板，汇总用户增长、团次状态、报名、点赞、登录会话、板块分布、热门规则及反馈举报队列。内容配置、账号与礼物、反馈受理、举报受理分别使用独立入口。反馈和举报写入 D1，图片存入 R2；单次最多 9 张且每张不超过 5MB，举报至少需要 1 张图片。管理员可筛选受理状态、填写备注并标记处理中、已解决或已驳回。账号列表按 QQ 号或昵称搜索、分页显示，点选账号可查看收礼和送礼记录。

## QQ 新团广播桥接

`POST /api/campaigns` 将团与 `campaign.created` 事件在同一个 D1 事务写入。测试机器人凭独立 Secret `BOT_BRIDGE_TOKEN` 每 15 秒从 `GET /api/internal/bot/events` 领取一个事件，完成原有群发后提交 `POST /api/internal/bot/events/{eventId}/ack`，正文为 `{ "claimId": "..." }`。事件携带 `eventId`、`campaignId`、`kind`、`rule`、`claimId`；`kind` 为 `online`、`offline` 或 `promo`，供机器人区分播报板块，旧机器人可忽略新增字段。广播不含链接。租约为 120 秒，过期事件可重新领取。测试站点须使用与生产不同的 D1、R2 和 Secret，且仅由双测试群机器人消费。网站发布接口不依赖机器人在线；迁移 `0003_bot_outbox.sql` 必须先于新代码应用。

测试环境使用单独 Pages 项目 `zgb-trpg-staging`、`wrangler.staging.jsonc` 中指定的独立 D1 和 R2，均已创建。运行 `npx wrangler d1 migrations apply zgb-trpg-staging --remote --config wrangler.staging.jsonc`，在**测试 Pages 项目**分别设置独立 `ADMIN_PASSWORD`、`BOT_BRIDGE_TOKEN`、`OTP_SECRET`、`RESEND_API_KEY` Secret，再运行 `pwsh -File scripts/deploy-staging.ps1`。脚本先检查测试绑定，再将构建产物、Functions 和测试配置复制到被 Git 忽略的独立目录部署；Wrangler Pages 不接受 `--config` 自定义配置路径。测试机器人只使用这个站点的 URL 和令牌；不得改用正式 D1 做联调。`0004_memberships.sql` 必须先于新报名代码部署；确认新流程可用后再部署删除凭证代码并应用 `0005_remove_vouchers.sql`。

目前测试项目已设置前三项 Secret 并完成一次使用临时测试会话的 API 发团→QQ 双群验收；临时会话已撤销。`RESEND_API_KEY` 尚未设置，因此测试站的 QQ 邮箱登录暂不可用，需设置测试专用密钥后才能从网页界面登录发团。

## 生产部署

GitHub 仓库为 [dqqql/zgb](https://github.com/dqqql/zgb)，生产地址为 [zgb-trpg.pages.dev](https://zgb-trpg.pages.dev)。Cloudflare Pages 项目 `zgb-trpg` 连接该仓库，生产分支 `main`，构建命令 `npm run build`，输出目录 `dist`。推送 `main` 会自动部署生产；其他分支使用预览部署。`wrangler.jsonc` 保存 D1/R2 绑定，远端迁移运行 `npm run db:migrate:remote`。

Pages 生产环境还需设置独立的加密 Secret `ADMIN_PASSWORD`，替换已公开的旧密码后再部署本版本；旧管理员 Cookie 会失效。`BOT_BRIDGE_TOKEN` 仅在准备接入相应机器人时设置，并与测试环境分别生成。`RESEND_FROM` 在 `wrangler.jsonc` 中设置。更换任何 Secret 后重新部署，再验证 `/api/health`、空首页和实际 QQ 邮件登录。不要在预览环境复用生产 Secret 或向真实用户发送测试验证码。

发布包含游戏平台字段的版本前，先运行 `npm run db:migrate:remote` 应用 `0008_game_platforms.sql`；Pages 的 Git 自动部署不会自动执行 D1 迁移。

此前用于释放 D1 配额的旧 `ssjz` 数据库已备份至本机 `backups/ssjz-2026-10-15.sql`；该目录被 Git 忽略。旧 `ssjz` Pages 项目仍存在，但原 D1 绑定已失效。

## 会员密钥

每个会员密钥可兑换 30 × 24 小时；从当前到期时间与兑换时间较晚者开始叠加。密钥只能全站兑换一次。会员目前只显示身份和到期时间，其他权益功能尚未接入。前台 `POST /api/membership/redeem` 接受 `{ "key": "VIP1.…" }`，后台“账号”可查看完整密钥及兑换历史。

密钥格式为 `VIP1.<nonce>.<signature>`。`nonce` 是 16 字节安全随机数的无填充 Base64URL 编码；`signature` 是 Ed25519 私钥对 UTF-8 字符串 `ZGB-MEMBER|VIP1|30D|<nonce>` 的签名，以无填充 Base64URL 编码。服务器只用公钥验签，不需要预先登记生成的密钥。把此段规则交给 AI 可让其编写兼容生成程序，但生成有效密钥仍须在本机使用私钥；不要向 AI、代码仓库或他人提供私钥。

首次在 **仓库之外** 建立测试与正式环境各自的密钥对（以下以正式环境为例，PowerShell）：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\membership-keys" | Out-Null
node scripts/membership-keys.mjs init --private "$env:USERPROFILE\membership-keys\production.pem" --public "$env:USERPROFILE\membership-keys\production-public.txt"
```

把 `production-public.txt` 的单行内容配置为 **正式 Pages 环境**的 `MEMBER_VERIFY_PUBLIC_KEY` 环境变量；测试环境另建 `staging.pem`/`staging-public.txt` 并配置测试公钥。本机首次部署已在 `wrangler.jsonc` 和 `wrangler.staging.jsonc` 分别填写公钥，私钥位于 `C:\Users\Dql\membership-keys`。公钥可公开，私钥文件仅在本机保管并做好安全备份；若私钥丢失，将无法继续生成与已配置公钥匹配的新密钥。修改公钥后重新部署 Pages。

按需生成密钥，每次指定一个新的输出文件名；脚本不会覆盖文件，也不会把密钥打印到终端：

```powershell
node scripts/membership-keys.mjs generate --private "$env:USERPROFILE\membership-keys\production.pem" --out "$env:USERPROFILE\membership-keys\membership-keys-001.txt" --count 20
```

`--count` 每次支持 1–10000 个，可重复运行。未兑换的密钥没有失效日期。部署时先应用 `0018_membership_keys.sql`（测试环境使用 `wrangler.staging.jsonc`，正式环境使用 `wrangler.jsonc`），再部署新 Functions；测试与正式密钥不可互用。
