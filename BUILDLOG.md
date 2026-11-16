# BUILDLOG — POCKET VICE

Главный источник правды. Пишется по ходу работы. Посты — только отсюда.

---

## 2026-11-16 · setup

- 14:01 старт `start`. Промпт владельца: «start» (через CLAUDE.md).
- Окружение (замер `--version`):
  - node v24.22.1, npm 11.19.1
  - git 2.55.0.windows.3
  - ffmpeg 8.1.2 (gyan.dev full_build)
  - gh CLI — не установлен
- Создана структура: `builds/`, `tools/`, `BUILDLOG.md`, `posted.md`, `CLAUDE.md`.
- Playwright 1.65.1 установлен (devDependency), Chromium 159.0.8154.6; smoke-тест: запуск ок, WebGL2 = true.
- git init (ветка main). Глобального git-identity нет → локально временно `0xMavex <0xMavex@users.noreply.github.com>`; поправить на настоящий noreply после входа в GitHub, до первого push.
