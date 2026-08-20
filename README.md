# Coding Agent 项目基线

这是一个面向新项目的版本化 Coding Agent 开发基线。它以 Agent 中立的 `AGENTS.md` 为共享指令源，优先验证 Codex，并通过薄适配层支持 Claude Code。

当前版本处于 `0.x`。第一版提供 TypeScript、Node.js 和 pnpm Profile，以及可审查的一次性初始化流程。

## 初始化派生项目

1. 从私有 GitHub Template 创建新仓库。
2. 安装 Node.js 24 与 Corepack。
3. 运行 `corepack pnpm install`。
4. 先执行 `corepack pnpm baseline:init --dry-run --name "项目名" --package-name "package-name" --description "一句话用途"`。
5. 审查计划后，移除 `--dry-run` 再执行一次。
6. 运行 `corepack pnpm check`。

初始化要求干净且尚未初始化的 Git 仓库。它不会创建 commit，也不会修改已经存在的派生项目。

## 维护基线

- `corepack pnpm baseline:skills:sync`：按照 Skill Manifest 更新 Agent 原生目录。
- `corepack pnpm baseline:skills:check`：验证 Skill 来源、哈希和投影一致性。
- `corepack pnpm check`：运行格式、类型、测试、构建和 Skill 供应链检查。
- `corepack pnpm baseline:release:check`：发布前验证真实仓库来源、完整 commit SHA、Changelog 与 Skill 投影。

正式发布前，将 `baseline.config.json` 中的 `sourceRepository` 和 `sourceCommit` 占位值替换为私有模板仓库及其已审核提交。日常开发不需要通过发布检查。

设计语言见 [CONTEXT.md](./CONTEXT.md)，长期决策见 [`docs/adr/`](./docs/adr/)。
