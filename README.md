# Coding Agent 项目基线

这是一个面向新项目的版本化 Coding Agent 开发基线。它以 Agent 中立的 `AGENTS.md` 为共享指令源，优先验证 Codex，并通过薄适配层支持 Claude Code。

当前版本处于 `0.x`。项目提供 TypeScript、Node.js 和 pnpm Profile，以及可交互选择 Coding Agent 的 Project Creator。

## 初始化派生项目

安装 Node.js 24 和 Git，然后运行：

```powershell
npx create-agent-scaffold@latest my-project
```

Creator 会询问项目元数据，并通过复选框选择一个或多个 Coding Agent；当前支持 Codex 和 Claude Code。确认后，它会生成项目、安装依赖、运行完整检查并初始化未提交的 `main` 分支。

初始化当前空目录：

```powershell
npx create-agent-scaffold@latest .
```

无交互自动化：

```powershell
npx create-agent-scaffold@latest my-project --agent codex --agent claude --yes
```

使用 `--all-agents` 选择当前 Agent Catalog 中的全部 Agent；使用 `--no-install` 跳过依赖安装和完整检查。

Creator 只接受不存在或完全空的目标目录，不会覆盖、合并或创建 commit、远程仓库。

## 维护基线

- `corepack pnpm baseline:skills:sync`：按照 Skill Manifest 更新 Agent 原生目录。
- `corepack pnpm baseline:skills:check`：验证 Skill 来源、哈希和投影一致性。
- `corepack pnpm creator:pack:test`：打包真实 npm tarball，并验证 Agent 选择矩阵与失败回滚。
- `corepack pnpm check`：运行格式、类型、测试、构建和 Skill 供应链检查。
- `corepack pnpm baseline:release:check`：发布前验证真实仓库来源、完整 commit SHA、Changelog 与 Skill 投影。

正式发布前，将 `baseline.config.json` 中的 `sourceRepository` 和 `sourceCommit` 占位值替换为私有模板仓库及其已审核提交。日常开发不需要通过发布检查。

设计语言见 [CONTEXT.md](./CONTEXT.md)，长期决策见 [`docs/adr/`](./docs/adr/)。
