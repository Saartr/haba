---
name: reference-figma-mcp
description: "Как подключить Figma Dev Mode MCP к Claude Code в этом проекте + обходной путь через curl"
metadata:
  type: reference
---

Figma Dev Mode MCP-сервер для вытягивания макетов из Figma TapaDS / Tapa App.

**Сервер:** Figma Desktop → Dev Mode → включить «Dev Mode MCP Server». Поднимается на `http://127.0.0.1:3845/mcp`.

**Регистрация в Claude Code:** прописан в `.mcp.json` в корне репо (project scope):
```json
{ "mcpServers": { "figma": { "type": "http", "url": "http://127.0.0.1:3845/mcp" } } }
```
Подхватывается ТОЛЬКО при старте сессии. После `claude mcp add` нужен полный перезапуск Claude Code (reload UI недостаточно). При первом старте — подтвердить доверие project MCP-серверу.

**Инструменты:** `get_design_context` (код+стили ноды), `get_variable_defs` (токены→hex/числа), `get_screenshot` (PNG ноды), `get_metadata` (дерево нод с id/координатами), `get_figjam`.

**Важно при get_design_context:** передавать `disableCodeConnect: true`, иначе сервер просит замапить Code Connect и не отдаёт контекст.

**Обходной путь, если MCP-инструменты не пробросились в сессию (баг VSCode-расширения):** говорить с сервером напрямую по JSON-RPC через curl/node. Хендшейк: `initialize` → запомнить заголовок `mcp-session-id` → `notifications/initialized` → `tools/call` с тем же `mcp-session-id`. Ответы в формате SSE (`event: message\ndata: {...}`) — снимать префикс `data: `. Скриншоты приходят как `content[].type==='image'` base64 → декодировать в PNG. На Windows: bash `/tmp` ≠ node `C:\tmp`, писать файлы по `C:/...` путям.

**Node-id:** из URL Figma `?node-id=682-2535` → в API передавать как `682:2535` (дефис→двоеточие).

**How to apply:** При работе по макету сначала пробовать `mcp__figma__*` инструменты. Если их нет в сессии — curl-обход. Реальные значения (отступы/радиусы/цвета) брать из `get_variable_defs`/`get_design_context`, не на глаз — см. [[feedback-figma-source-of-truth]]. Файлы Figma: TapaDS (дизайн-система) и Tapa App (`yTlBE7MQqQTvxez3UP4n48`, экраны).
